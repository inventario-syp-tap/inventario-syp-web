// Reglas contables (docs/UI-UX.md §5.16). Vigencia AAAA-MM (inclusive). Al crear se fijan tipo, producto,
// operación y cuentas; al editar solo vigente hasta, decisión y descripción. La API decide si la vigencia se cruza
// con otra regla (409 VIGENCIA_SUPERPUESTA): aquí solo se revisa la forma.
import { z } from 'zod'
import type { DatosCrearRegla, DatosEditarRegla, ReglaContable, TipoAsiento } from '@/api/reglas-contables'
import { nombreMes } from '@/lib/formato'

export const TIPOS_ASIENTO = ['COSTO_VENTAS', 'MERMA', 'DESMEDRO', 'AJUSTE_FALTANTE', 'AJUSTE_SOBRANTE'] as const satisfies readonly TipoAsiento[]

export const NOMBRE_TIPO_ASIENTO: Record<TipoAsiento, string> = {
  COSTO_VENTAS: 'Costo de ventas',
  MERMA: 'Merma',
  DESMEDRO: 'Desmedro',
  AJUSTE_FALTANTE: 'Ajuste faltante',
  AJUSTE_SOBRANTE: 'Ajuste sobrante',
}

/** Operación (Tabla 12) que corresponde a cada asiento; la API rechaza otra con OPERACION_NO_CORRESPONDE. */
export const OPERACIONES_POR_ASIENTO: Record<TipoAsiento, readonly string[]> = {
  COSTO_VENTAS: ['01', '17'],
  MERMA: ['13'],
  DESMEDRO: ['14'],
  AJUSTE_FALTANTE: ['28'],
  AJUSTE_SOBRANTE: ['28'],
}

/** Nombres de respaldo si /catalogos (Tabla 12) aún no llegó. */
export const NOMBRE_OPERACION: Record<string, string> = {
  '01': 'Venta nacional',
  '17': 'Exportación',
  '13': 'Merma',
  '14': 'Desmedro',
  '28': 'Ajuste por diferencia de inventario',
}

const PATRON_MES = /^\d{4}-(0[1-9]|1[0-2])$/
const MENSAJE_MES = 'Usa el formato AAAA-MM (por ejemplo 2026-01).'

const mesObligatorio = z.string().trim().regex(PATRON_MES, MENSAJE_MES)
const mesOpcional = z.string().trim().refine((v) => v === '' || PATRON_MES.test(v), MENSAJE_MES)
const cuenta = (nombre: string) => z.string().trim().regex(/^\d{2,12}$/, `La cuenta ${nombre} tiene de 2 a 12 dígitos.`)
const decision = z.string().trim().min(1, 'Indica la decisión que sustenta la regla (D-xx, PC-xx…).').max(120, 'Máximo 120 caracteres.')
const descripcion = z.string().trim().min(1, 'Escribe la descripción.').max(200, 'Máximo 200 caracteres.')

/** "AAAA-MM" se compara como texto: el orden alfabético coincide con el cronológico. */
const hastaAntesDeDesde = (desde: string, hasta: string) => hasta !== '' && PATRON_MES.test(desde) && hasta < desde
const MENSAJE_ORDEN = '"Vigente hasta" no puede ser anterior a "vigente desde".'

export const esquemaCrearRegla = z
  .object({
    tipoAsiento: z.enum(TIPOS_ASIENTO, { message: 'Elige el tipo de asiento.' }),
    productoId: z.string().min(1, 'Elige el producto.'),
    tipoOperacion: z.string().min(1, 'Elige la operación.'),
    cuentaDebe: cuenta('Debe'),
    cuentaHaber: cuenta('Haber'),
    vigenteDesde: mesObligatorio,
    vigenteHasta: mesOpcional,
    decision,
    descripcion,
  })
  .superRefine((datos, ctx) => {
    if (!OPERACIONES_POR_ASIENTO[datos.tipoAsiento].includes(datos.tipoOperacion)) {
      ctx.addIssue({ code: 'custom', path: ['tipoOperacion'], message: 'Esa operación no corresponde al tipo de asiento.' })
    }
    if (hastaAntesDeDesde(datos.vigenteDesde, datos.vigenteHasta)) {
      ctx.addIssue({ code: 'custom', path: ['vigenteHasta'], message: MENSAJE_ORDEN })
    }
  })

export type FormularioCrearRegla = z.infer<typeof esquemaCrearRegla>
export const CAMPOS_CREAR_REGLA = [
  'tipoAsiento', 'productoId', 'tipoOperacion', 'cuentaDebe', 'cuentaHaber', 'vigenteDesde', 'vigenteHasta', 'decision', 'descripcion',
] as const satisfies readonly (keyof FormularioCrearRegla)[]

/** Al editar o cerrar, "vigente hasta" se compara con el "vigente desde" de la regla. */
export const esquemaEditarRegla = (vigenteDesde: string) =>
  z
    .object({ vigenteHasta: mesOpcional, decision, descripcion })
    .superRefine((datos, ctx) => {
      if (hastaAntesDeDesde(vigenteDesde, datos.vigenteHasta)) {
        ctx.addIssue({ code: 'custom', path: ['vigenteHasta'], message: MENSAJE_ORDEN })
      }
    })

export type FormularioEditarRegla = z.infer<ReturnType<typeof esquemaEditarRegla>>
export const CAMPOS_EDITAR_REGLA = ['vigenteHasta', 'decision', 'descripcion'] as const

/** Cerrar = poner "vigente hasta" (obligatorio). Decisión y descripción pasan sin cambios. */
export const esquemaCerrarRegla = (vigenteDesde: string) =>
  z
    .object({ vigenteHasta: mesObligatorio, decision: z.string(), descripcion: z.string() })
    .superRefine((datos, ctx) => {
      if (hastaAntesDeDesde(vigenteDesde, datos.vigenteHasta)) {
        ctx.addIssue({ code: 'custom', path: ['vigenteHasta'], message: MENSAJE_ORDEN })
      }
    })

export type FormularioCerrarRegla = z.infer<ReturnType<typeof esquemaCerrarRegla>>

export const valoresCrear = (): FormularioCrearRegla => ({
  tipoAsiento: 'COSTO_VENTAS', productoId: '', tipoOperacion: '01', cuentaDebe: '', cuentaHaber: '',
  vigenteDesde: '', vigenteHasta: '', decision: '', descripcion: '',
})

export function aCrear(datos: FormularioCrearRegla): DatosCrearRegla {
  return {
    tipoAsiento: datos.tipoAsiento,
    productoId: Number.parseInt(datos.productoId, 10),
    tipoOperacion: datos.tipoOperacion,
    cuentaDebe: datos.cuentaDebe,
    cuentaHaber: datos.cuentaHaber,
    vigenteDesde: datos.vigenteDesde,
    vigenteHasta: datos.vigenteHasta === '' ? null : datos.vigenteHasta,
    decision: datos.decision,
    descripcion: datos.descripcion,
  }
}

/** PATCH con solo los 3 campos editables, y solo si cambiaron. */
export function aEditar(datos: FormularioEditarRegla, original: ReglaContable): DatosEditarRegla {
  const cambios: DatosEditarRegla = {}
  const hasta = datos.vigenteHasta === '' ? null : datos.vigenteHasta
  if (hasta !== original.vigenteHasta) cambios.vigenteHasta = hasta
  if (datos.decision !== original.decision) cambios.decision = datos.decision
  if (datos.descripcion !== original.descripcion) cambios.descripcion = datos.descripcion
  return cambios
}

/** "2026-01" → "Enero 2026" (partiendo el texto, sin Date). */
export function formatearMes(mes: string | null): string {
  if (!mes) return 'sin fin'
  const partes = /^(\d{4})-(\d{2})$/.exec(mes)
  return partes ? `${nombreMes(Number.parseInt(partes[2], 10))} ${partes[1]}` : mes
}

export const formatearVigencia = (desde: string, hasta: string | null) => `${formatearMes(desde)} – ${formatearMes(hasta)}`

/** Mes actual "AAAA-MM" en la hora local del equipo. */
export function mesActual(ahora = new Date()): string {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`
}

/** Una regla está cerrada si su "vigente hasta" ya pasó. */
export const reglaCerrada = (regla: Pick<ReglaContable, 'vigenteHasta'>, mes = mesActual()) =>
  regla.vigenteHasta !== null && regla.vigenteHasta < mes
