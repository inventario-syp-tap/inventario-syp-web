// Formulario de cliente o proveedor (docs/UI-UX.md §5.16). Aquí solo se revisa la forma: el dígito verificador
// del RUC y si el documento ya existe los decide la API (GET /terceros/validar-documento y el POST).
import { z } from 'zod'
import type { DatosCrearTercero, DatosEditarTercero, Tercero, TipoDocumento } from '@/api/terceros'
import { vacioANulo } from '@/lib/formularios'

export const TIPOS_DOCUMENTO = ['6', '1', '4', '7', 'A', '0'] as const satisfies readonly TipoDocumento[]

/** Nombres de respaldo si /catalogos (Tabla 2) aún no llegó. */
export const NOMBRE_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  '6': 'RUC',
  '1': 'DNI',
  '4': 'Carné de extranjería',
  '7': 'Pasaporte',
  A: 'Cédula diplomática',
  '0': 'Otros / exterior (sin número)',
}

/** Largo exacto que exige cada tipo (los demás: 1 a 20 caracteres). */
export const LARGO_DOCUMENTO: Partial<Record<TipoDocumento, number>> = { '6': 11, '1': 8 }

/** ¿Tiene la forma completa para preguntarle a la API? (evita "RUC no válido" mientras se escribe). */
export function documentoCompleto(tipo: TipoDocumento, numero: string): boolean {
  const limpio = numero.trim()
  if (tipo === '0' || limpio === '') return false
  const largo = LARGO_DOCUMENTO[tipo]
  return largo ? new RegExp(`^\\d{${largo}}$`).test(limpio) : limpio.length <= 20
}

export const esquemaTercero = z
  .object({
    tipoDocumento: z.enum(TIPOS_DOCUMENTO, { message: 'Elige el tipo de documento.' }),
    numeroDocumento: z.string().trim().max(20, 'El número tiene como máximo 20 caracteres.'),
    razonSocial: z.string().trim().min(1, 'Escribe la razón social o el nombre.').max(200, 'Máximo 200 caracteres.'),
    pais: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/, 'Usa el código de 2 letras del país (PE, US…).'),
    direccion: z.string().trim().max(250, 'Máximo 250 caracteres.'),
    esProveedor: z.boolean(),
    esCliente: z.boolean(),
    activo: z.boolean(),
  })
  .superRefine((datos, ctx) => {
    const numero = datos.numeroDocumento
    if (datos.tipoDocumento !== '0') {
      const largo = LARGO_DOCUMENTO[datos.tipoDocumento]
      if (numero === '') {
        ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: 'Escribe el número de documento.' })
      } else if (largo && !new RegExp(`^\\d{${largo}}$`).test(numero)) {
        const nombre = datos.tipoDocumento === '6' ? 'El RUC' : 'El DNI'
        ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: `${nombre} tiene ${largo} dígitos, sin espacios ni guiones.` })
      }
    }
    if (!datos.esProveedor && !datos.esCliente) {
      ctx.addIssue({ code: 'custom', path: ['esProveedor'], message: 'Marca si es proveedor, cliente o ambos.' })
    }
  })

export type FormularioTercero = z.infer<typeof esquemaTercero>

export const CAMPOS_TERCERO = [
  'tipoDocumento', 'numeroDocumento', 'razonSocial', 'pais', 'direccion', 'esProveedor', 'esCliente', 'activo',
] as const satisfies readonly (keyof FormularioTercero)[]

export function valoresIniciales(tercero?: Tercero, rol?: 'PROVEEDOR' | 'CLIENTE'): FormularioTercero {
  if (tercero) {
    return {
      tipoDocumento: tercero.tipoDocumento as TipoDocumento,
      numeroDocumento: tercero.numeroDocumento ?? '',
      razonSocial: tercero.razonSocial,
      pais: tercero.pais ?? '',
      direccion: tercero.direccion ?? '',
      esProveedor: tercero.esProveedor,
      esCliente: tercero.esCliente,
      activo: tercero.activo,
    }
  }
  return {
    tipoDocumento: '6', numeroDocumento: '', razonSocial: '', pais: 'PE', direccion: '',
    esProveedor: rol !== 'CLIENTE', esCliente: rol === 'CLIENTE', activo: true,
  }
}

/** Datos para el POST: razón social en mayúsculas y tipo 0 sin número (D-12). */
export function aCrear(datos: FormularioTercero): DatosCrearTercero {
  return {
    tipoDocumento: datos.tipoDocumento,
    numeroDocumento: datos.tipoDocumento === '0' ? null : datos.numeroDocumento,
    razonSocial: datos.razonSocial.toUpperCase(),
    pais: vacioANulo(datos.pais),
    esProveedor: datos.esProveedor,
    esCliente: datos.esCliente,
    direccion: vacioANulo(datos.direccion),
  }
}

/** Datos para el PATCH: solo lo que cambió (la API valida el documento solo si cambia). */
export function aEditar(datos: FormularioTercero, original: Tercero): DatosEditarTercero {
  const nuevo = { ...aCrear(datos), activo: datos.activo }
  const cambios: DatosEditarTercero = {}
  if (nuevo.tipoDocumento !== original.tipoDocumento) cambios.tipoDocumento = nuevo.tipoDocumento
  if (nuevo.numeroDocumento !== original.numeroDocumento) cambios.numeroDocumento = nuevo.numeroDocumento
  if (nuevo.razonSocial !== original.razonSocial) cambios.razonSocial = nuevo.razonSocial
  if (nuevo.pais !== original.pais) cambios.pais = nuevo.pais
  if (nuevo.direccion !== original.direccion) cambios.direccion = nuevo.direccion
  if (nuevo.esProveedor !== original.esProveedor) cambios.esProveedor = nuevo.esProveedor
  if (nuevo.esCliente !== original.esCliente) cambios.esCliente = nuevo.esCliente
  if (nuevo.activo !== original.activo) cambios.activo = nuevo.activo
  return cambios
}

/** "RUC 20000000010" · "DNI 00000001" · "Sin documento". */
export function textoDocumento(tercero: Pick<Tercero, 'tipoDocumento' | 'numeroDocumento'>): string {
  if (!tercero.numeroDocumento) return 'Sin documento'
  const tipo = tercero.tipoDocumento as TipoDocumento
  const corto = tipo === '6' ? 'RUC' : tipo === '1' ? 'DNI' : NOMBRE_TIPO_DOCUMENTO[tipo] ?? `Tipo ${tipo}`
  return `${corto} ${tercero.numeroDocumento}`
}
