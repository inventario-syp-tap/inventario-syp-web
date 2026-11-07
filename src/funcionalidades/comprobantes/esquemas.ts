// Formulario de comprobante con varias líneas (docs/UI-UX.md §5.3 a §5.6). Aquí solo se revisa la forma: stock,
// costos, saldos, correlativos y periodos los decide la API. Todo decimal es texto (string) de punta a punta;
// los importes y totales de la pantalla son una VISTA PREVIA con big.js.
import Big from 'big.js'
import { z } from 'zod'
import type {
  Comprobante, DatosAjuste, DatosCompra, DatosEditarComprobante, DatosMerma, DatosVenta, Naturaleza,
} from '@/api/comprobantes'
import type { Tercero } from '@/api/terceros'
import { formatearDecimal, formatearDocumento, formatearSoles } from '@/lib/formato'

export type TerceroElegido = Pick<Tercero, 'id' | 'tipoDocumento' | 'numeroDocumento' | 'razonSocial'>
export type Moneda = 'PEN' | 'USD'
export type TipoMovimiento = 'ENTRADA' | 'SALIDA'

export type LineaFormulario = {
  /** Id del movimiento que se conserva al editar. */
  id?: string
  productoId: string
  descripcion: string
  /** TN, hasta 4 decimales. */
  cantidad: string
  /** Costo unitario (compra, ajuste con costo) o valor de venta unitario (venta), sin IGV, hasta 6 decimales. */
  precio: string
  tipoMovimiento: TipoMovimiento
  costoAlPromedio: boolean
}

export type FormularioComprobante = {
  establecimientoId: string
  fecha: string
  tercero: TerceroElegido | null
  tipoComprobante: '01' | '03'
  serie: string
  numero: string
  /** 01/17 en venta, 13/14 en merma (en compra 02 y en ajuste 28, fijos: no se envían). */
  tipoOperacion: string
  moneda: Moneda
  tipoCambio: string
  anioInforme: string
  sustento: string
  guiaRemision: string
  ticketBalanza: string
  placaVehiculo: string
  observacion: string
  lineas: LineaFormulario[]
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/
const RE_CANTIDAD = /^\d+(\.\d{1,4})?$/
const RE_PRECIO = /^\d+(\.\d{1,6})?$/
const RE_TIPO_CAMBIO = /^\d+(\.\d{1,3})?$/

const esPositivo = (texto: string) => {
  try {
    return new Big(texto).gt(0)
  } catch {
    return false
  }
}

export const lineaVacia = (tipoMovimiento: TipoMovimiento = 'ENTRADA'): LineaFormulario => ({
  productoId: '', descripcion: '', cantidad: '', precio: '', tipoMovimiento, costoAlPromedio: true,
})

/** Valores de un comprobante nuevo (se conservan fecha y establecimiento en "Guardar y nueva"). */
export function valoresNuevos(naturaleza: Naturaleza, fecha: string, establecimientoId: string): FormularioComprobante {
  return {
    establecimientoId,
    fecha,
    tercero: null,
    tipoComprobante: '01',
    serie: '',
    numero: '',
    tipoOperacion: naturaleza === 'VENTA' ? '01' : naturaleza === 'MERMA' ? '13' : '',
    moneda: 'PEN',
    tipoCambio: '',
    anioInforme: fecha.slice(0, 4),
    sustento: '',
    guiaRemision: '',
    ticketBalanza: '',
    placaVehiculo: '',
    observacion: '',
    lineas: [lineaVacia(naturaleza === 'AJUSTE' ? 'ENTRADA' : naturaleza === 'COMPRA' ? 'ENTRADA' : 'SALIDA')],
  }
}

/** Valores para editar un comprobante registrado. */
export function valoresDesdeComprobante(c: Comprobante): FormularioComprobante {
  const anioInforme = /^\d{4}$/.test(c.numero) ? c.numero : c.fecha.slice(0, 4)
  return {
    establecimientoId: String(c.lineas[0]?.establecimientoId ?? ''),
    fecha: c.fecha.slice(0, 10),
    tercero: c.tercero,
    tipoComprobante: c.tipoComprobante === '03' ? '03' : '01',
    serie: c.serie,
    numero: c.numero,
    tipoOperacion: c.tipoOperacion,
    moneda: c.moneda,
    tipoCambio: c.tipoCambio ?? '',
    anioInforme,
    sustento: c.sustento ?? '',
    guiaRemision: c.guiaRemision ?? '',
    ticketBalanza: c.ticketBalanza ?? '',
    placaVehiculo: c.placaVehiculo ?? '',
    observacion: c.observacion ?? '',
    lineas: c.lineas.map((l) => ({
      id: l.id,
      productoId: String(l.productoId),
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio: (c.naturaleza === 'VENTA' ? l.valorVentaUnitario : l.costoAlPromedio ? null : l.costoUnitario) ?? '',
      tipoMovimiento: l.tipoMovimiento,
      costoAlPromedio: l.costoAlPromedio,
    })),
  }
}

/** ¿La línea lleva precio? Compra y venta siempre; ajuste solo en entradas con costo informado. */
export function llevaPrecio(naturaleza: Naturaleza, linea: Pick<LineaFormulario, 'tipoMovimiento' | 'costoAlPromedio'>): boolean {
  if (naturaleza === 'COMPRA' || naturaleza === 'VENTA') return true
  if (naturaleza === 'AJUSTE') return linea.tipoMovimiento === 'ENTRADA' && !linea.costoAlPromedio
  return false
}

const terceroElegido = z.custom<TerceroElegido | null>((valor) => valor === null || (typeof valor === 'object' && valor !== null && 'id' in valor))

const esquemaLinea = z.object({
  id: z.string().optional(),
  productoId: z.string().min(1, 'Elige el producto.'),
  descripcion: z.string().trim().min(1, 'Escribe la descripción o calidad.').max(200, 'Máximo 200 caracteres.'),
  cantidad: z.string().trim(),
  precio: z.string().trim(),
  tipoMovimiento: z.enum(['ENTRADA', 'SALIDA']),
  costoAlPromedio: z.boolean(),
})

/** Esquema zod del formulario según la naturaleza (mensajes en español). */
export function esquemaComprobante(naturaleza: Naturaleza) {
  return z
    .object({
      establecimientoId: z.string().min(1, 'Elige el establecimiento.'),
      fecha: z.string().regex(RE_FECHA, 'Indica la fecha de emisión.'),
      tercero: terceroElegido,
      tipoComprobante: z.enum(['01', '03']),
      serie: z.string().trim(),
      numero: z.string().trim(),
      tipoOperacion: z.string(),
      moneda: z.enum(['PEN', 'USD']),
      tipoCambio: z.string().trim(),
      anioInforme: z.string().trim(),
      sustento: z.string().trim().max(500, 'Máximo 500 caracteres.'),
      guiaRemision: z.string().trim().max(30, 'Máximo 30 caracteres.'),
      ticketBalanza: z.string().trim().max(30, 'Máximo 30 caracteres.'),
      placaVehiculo: z.string().trim().max(15, 'Máximo 15 caracteres.'),
      observacion: z.string().trim().max(500, 'Máximo 500 caracteres.'),
      lineas: z.array(esquemaLinea).min(1, 'Agrega al menos una línea.'),
    })
    .superRefine((v, ctx) => {
      const error = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

      if (naturaleza === 'COMPRA' || naturaleza === 'VENTA') {
        if (!v.tercero) error(['tercero'], naturaleza === 'COMPRA' ? 'Elige el proveedor.' : 'Elige el cliente.')
        if (!/^[A-Za-z0-9]{1,4}$/.test(v.serie)) error(['serie'], 'La serie tiene de 1 a 4 letras o dígitos (F001).')
        if (!/^\d{1,8}$/.test(v.numero)) error(['numero'], 'El número tiene de 1 a 8 dígitos.')
      }
      if (naturaleza === 'VENTA') {
        if (v.tipoOperacion !== '01' && v.tipoOperacion !== '17') error(['tipoOperacion'], 'Elige la operación.')
        if (v.tipoComprobante === '03' && v.tipoOperacion === '17') error(['tipoOperacion'], 'La exportación requiere factura.')
        if (v.moneda === 'USD' && !(RE_TIPO_CAMBIO.test(v.tipoCambio) && esPositivo(v.tipoCambio))) {
          error(['tipoCambio'], 'Indica el tipo de cambio de la fecha de emisión (hasta 3 decimales).')
        }
      }
      if (naturaleza === 'MERMA') {
        if (v.tipoOperacion !== '13' && v.tipoOperacion !== '14') error(['tipoOperacion'], 'Elige merma o desmedro.')
        if (v.tipoOperacion === '13' && !/^\d{4}$/.test(v.anioInforme)) error(['anioInforme'], 'Indica el año del informe técnico (AAAA).')
      }
      if ((naturaleza === 'MERMA' || naturaleza === 'AJUSTE') && !v.sustento) {
        error(['sustento'], naturaleza === 'MERMA' ? 'Indica el sustento (informe técnico o acta).' : 'Indica el sustento (acta de toma de inventario).')
      }

      v.lineas.forEach((linea, i) => {
        if (!(RE_CANTIDAD.test(linea.cantidad) && esPositivo(linea.cantidad))) {
          error(['lineas', i, 'cantidad'], 'Cantidad mayor que 0, hasta 4 decimales.')
        }
        if (llevaPrecio(naturaleza, linea) && !RE_PRECIO.test(linea.precio)) {
          error(['lineas', i, 'precio'], naturaleza === 'VENTA' ? 'Indica el valor de venta sin IGV (hasta 6 decimales).' : 'Indica el costo sin IGV (hasta 6 decimales).')
        }
      })
    })
}

// ---- Conversión a los DTO de la API (todo decimal sigue siendo string) ----

const opcional = (texto: string) => (texto.trim() === '' ? undefined : texto.trim())
const entero = (texto: string) => Number.parseInt(texto, 10)

function cabeceraComun(v: FormularioComprobante) {
  return {
    fecha: v.fecha,
    establecimientoId: entero(v.establecimientoId),
    observacion: opcional(v.observacion),
  }
}

function referencias(v: FormularioComprobante) {
  return {
    serie: v.serie.trim().toUpperCase(),
    numero: v.numero.trim(),
    terceroId: v.tercero?.id ?? 0,
    guiaRemision: opcional(v.guiaRemision),
    ticketBalanza: opcional(v.ticketBalanza),
    placaVehiculo: opcional(v.placaVehiculo),
  }
}

const baseLinea = (l: LineaFormulario) => ({ productoId: entero(l.productoId), descripcion: l.descripcion.trim(), cantidad: l.cantidad.trim() })

export const aCompra = (v: FormularioComprobante): DatosCompra => ({
  ...cabeceraComun(v),
  ...referencias(v),
  tipoComprobante: '01',
  lineas: v.lineas.map((l) => ({ ...baseLinea(l), costoUnitario: l.precio.trim() })),
})

export const aVenta = (v: FormularioComprobante): DatosVenta => ({
  ...cabeceraComun(v),
  ...referencias(v),
  tipoComprobante: v.tipoComprobante,
  tipoOperacion: v.tipoComprobante === '03' ? '01' : (v.tipoOperacion as '01' | '17'),
  moneda: v.moneda,
  tipoCambio: v.moneda === 'USD' ? v.tipoCambio.trim() : undefined,
  lineas: v.lineas.map((l) => ({ ...baseLinea(l), valorVentaUnitario: l.precio.trim() })),
})

export const aMerma = (v: FormularioComprobante): DatosMerma => ({
  ...cabeceraComun(v),
  tipoOperacion: v.tipoOperacion as '13' | '14',
  anioInforme: v.tipoOperacion === '13' ? entero(v.anioInforme) : undefined,
  sustento: v.sustento.trim(),
  lineas: v.lineas.map(baseLinea),
})

function lineaAjuste(l: LineaFormulario) {
  if (l.tipoMovimiento === 'SALIDA') return { ...baseLinea(l), tipoMovimiento: 'SALIDA' as const }
  return l.costoAlPromedio
    ? { ...baseLinea(l), tipoMovimiento: 'ENTRADA' as const, costoAlPromedio: true }
    : { ...baseLinea(l), tipoMovimiento: 'ENTRADA' as const, costoUnitario: l.precio.trim() }
}

export const aAjuste = (v: FormularioComprobante): DatosAjuste => ({
  ...cabeceraComun(v),
  sustento: v.sustento.trim(),
  lineas: v.lineas.map(lineaAjuste),
})

/** Líneas para PATCH: conservan su `id`; un precio vacío no se envía (la API conserva el guardado, D-11). */
function lineasEditar(naturaleza: Naturaleza, lineas: LineaFormulario[]): NonNullable<DatosEditarComprobante['lineas']> {
  return lineas.map((l) => {
    const precio = opcional(l.precio)
    const base = { ...baseLinea(l), ...(l.id ? { id: l.id } : {}) }
    if (naturaleza === 'COMPRA') return { ...base, ...(precio ? { costoUnitario: precio } : {}) }
    if (naturaleza === 'VENTA') return { ...base, ...(precio ? { valorVentaUnitario: precio } : {}) }
    if (naturaleza === 'AJUSTE') {
      if (l.tipoMovimiento === 'SALIDA') return { ...base, tipoMovimiento: 'SALIDA' }
      return l.costoAlPromedio
        ? { ...base, tipoMovimiento: 'ENTRADA', costoAlPromedio: true }
        : { ...base, tipoMovimiento: 'ENTRADA', costoAlPromedio: false, ...(precio ? { costoUnitario: precio } : {}) }
    }
    return base
  })
}

/** PATCH con solo lo que cambió (como en los maestros del S7). Vacío → no hay nada que guardar. */
export function aEditar(naturaleza: Naturaleza, v: FormularioComprobante, inicial: FormularioComprobante): DatosEditarComprobante {
  const datos: DatosEditarComprobante = {}
  const cambio = (campo: keyof FormularioComprobante) => JSON.stringify(v[campo]) !== JSON.stringify(inicial[campo])
  if (cambio('fecha')) datos.fecha = v.fecha
  if (cambio('observacion')) datos.observacion = v.observacion.trim()
  if (naturaleza === 'COMPRA' || naturaleza === 'VENTA') {
    if (cambio('serie')) datos.serie = v.serie.trim().toUpperCase()
    if (cambio('numero')) datos.numero = v.numero.trim()
    if (v.tercero && v.tercero.id !== inicial.tercero?.id) datos.terceroId = v.tercero.id
    if (cambio('guiaRemision')) datos.guiaRemision = v.guiaRemision.trim()
    if (cambio('ticketBalanza')) datos.ticketBalanza = v.ticketBalanza.trim()
    if (cambio('placaVehiculo')) datos.placaVehiculo = v.placaVehiculo.trim()
  }
  if (naturaleza === 'VENTA') {
    if (cambio('tipoComprobante')) datos.tipoComprobante = v.tipoComprobante
    const operacion = v.tipoComprobante === '03' ? '01' : v.tipoOperacion
    if (operacion !== inicial.tipoOperacion) datos.tipoOperacion = operacion as '01' | '17'
    if (cambio('moneda')) datos.moneda = v.moneda
    if (v.moneda === 'USD' && (cambio('tipoCambio') || cambio('moneda'))) datos.tipoCambio = v.tipoCambio.trim()
    if (v.moneda === 'PEN' && cambio('moneda')) datos.tipoCambio = null
  }
  if (naturaleza === 'MERMA' && v.tipoOperacion === '13' && cambio('anioInforme')) datos.anioInforme = entero(v.anioInforme)
  if ((naturaleza === 'MERMA' || naturaleza === 'AJUSTE') && cambio('sustento')) datos.sustento = v.sustento.trim()
  if (cambio('lineas')) datos.lineas = lineasEditar(naturaleza, v.lineas)
  return datos
}

// ---- Vista previa (big.js): nunca es el valor oficial ----

const aBig = (texto: string): Big | null => {
  try {
    return texto.trim() === '' ? null : new Big(texto.trim())
  } catch {
    return null
  }
}

/** Importe de una línea (cantidad × precio, 2 decimales) o null si falta algo. */
export function importeLinea(linea: Pick<LineaFormulario, 'cantidad' | 'precio'>): string | null {
  const cantidad = aBig(linea.cantidad)
  const precio = aBig(linea.precio)
  return cantidad && precio ? cantidad.times(precio).round(2, Big.roundHalfUp).toFixed(2) : null
}

/** Totales de la vista previa: toneladas (todas las líneas) e importe (solo las que llevan precio). */
export function totales(naturaleza: Naturaleza, lineas: readonly LineaFormulario[]): { toneladas: string; importe: string | null } {
  let toneladas = new Big(0)
  let importe = new Big(0)
  let hayImporte = false
  for (const linea of lineas) {
    const cantidad = aBig(linea.cantidad)
    if (cantidad) toneladas = toneladas.plus(cantidad)
    const parcial = llevaPrecio(naturaleza, linea) ? importeLinea(linea) : null
    if (parcial) {
      importe = importe.plus(parcial)
      hayImporte = true
    }
  }
  return { toneladas: toneladas.toFixed(4), importe: hayImporte ? importe.toFixed(2) : null }
}

/** "S/ 1,234.50" o "US$ 1,234.50". */
export function formatearImporte(valor: string | null | undefined, moneda: Moneda): string {
  if (moneda === 'PEN') return formatearSoles(valor)
  const texto = formatearDecimal(valor, 2)
  return texto === '—' ? texto : `US$ ${texto}`
}

// ---- Nombres para la pantalla ----

/** "Compra", "Venta", "Exportación", "Merma", "Desmedro" o "Ajuste". */
export function nombreOperacion(c: Pick<Comprobante, 'naturaleza' | 'tipoOperacion'>): string {
  if (c.naturaleza === 'COMPRA') return 'Compra'
  if (c.naturaleza === 'VENTA') return c.tipoOperacion === '17' ? 'Exportación' : 'Venta'
  if (c.naturaleza === 'MERMA') return c.tipoOperacion === '14' ? 'Desmedro' : 'Merma'
  return 'Ajuste'
}

/** "Compra registrada", "Ajuste registrado": terminación del participio según la operación. */
export function participio(c: Pick<Comprobante, 'naturaleza' | 'tipoOperacion'>, raiz: string): string {
  const nombre = nombreOperacion(c)
  return `${raiz}${nombre === 'Desmedro' || nombre === 'Ajuste' ? 'o' : 'a'}`
}

const NOMBRE_COMPROBANTE: Record<string, string> = { '01': 'Factura', '03': 'Boleta', '00': 'Documento interno' }

export const nombreTipoComprobante = (tipo: string) => NOMBRE_COMPROBANTE[tipo] ?? `Tipo ${tipo}`

/** Documento para mostrar: F001-0000123 en facturas y boletas; el interno tal como lo arma la API (00-IT-2026). */
export function documentoComprobante(c: Pick<Comprobante, 'tipoComprobante' | 'serie' | 'numero' | 'documento'>): string {
  if (c.tipoComprobante === '01' || c.tipoComprobante === '03') return formatearDocumento(c.serie, c.numero)
  return c.documento.startsWith(`${c.tipoComprobante}-`) ? c.documento : `${c.tipoComprobante}-${c.serie}-${c.numero}`
}
