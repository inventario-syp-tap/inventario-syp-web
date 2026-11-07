// Dónde mostrar cada error de la API al registrar o editar un comprobante (docs/UI-UX.md §6):
//  - confirmar  → 409 STOCK_NEGATIVO_REQUIERE_CONFIRMACION: DialogoStockNegativo y reenvío con la confirmación.
//  - reintentar → 409 ORDEN_EN_CONFLICTO: aviso con "Reintentar" (la API revirtió todo: reenviar es seguro).
//  - formulario → mensaje en el encabezado y/o errores junto a cada campo (y, si está anulado, solo lectura).
// Es una función pura: la prueban errores-operacion.test.ts, código por código.
import type { Path } from 'react-hook-form'
import type { FormularioComprobante } from './esquemas'
import type { Naturaleza } from '@/api/comprobantes'
import { leerDetalleStockNegativo, type DetalleStockNegativo } from '@/lib/stock-negativo'
import { camposConError, ErrorApi, mensajeDeError } from '@/lib/errores'
import { formatearDocumento } from '@/lib/formato'

export type CampoFormulario = Path<FormularioComprobante>
export type ErrorDeCampo = { campo: CampoFormulario; mensaje: string }

export type UbicacionError =
  | { tipo: 'confirmar'; detalle: DetalleStockNegativo }
  | { tipo: 'reintentar'; mensaje: string }
  | { tipo: 'formulario'; mensaje: string | null; campos: ErrorDeCampo[]; soloLectura?: boolean }

export type ContextoError = {
  naturaleza: Naturaleza
  valores: FormularioComprobante
  /** Nombre del producto por id ("FIERRO · Chatarra"), si se conoce. */
  nombreProducto: (id: number) => string | null
  edicion: boolean
  /** El usuario solo tiene el rol ASISTENTE (para el 403 al editar algo que no registró él). */
  soloAsistente: boolean
}

export const MENSAJE_ASISTENTE_SIN_PERMISO = 'Solo puedes editar las compras y ventas que registraste tú.'

const CAMPOS_SIMPLES: readonly CampoFormulario[] = [
  'establecimientoId', 'fecha', 'tercero', 'tipoComprobante', 'serie', 'numero', 'tipoOperacion', 'moneda', 'tipoCambio',
  'anioInforme', 'sustento', 'guiaRemision', 'ticketBalanza', 'placaVehiculo', 'observacion',
]

/** Nombre de campo de la API → campo del formulario (terceroId → tercero, costoUnitario → precio…). */
export function campoDelFormulario(campoApi: string): CampoFormulario | null {
  const linea = /^lineas[.[](\d+)\]?\.(\w+)$/.exec(campoApi)
  if (linea) {
    const [, indice, nombre] = linea
    const propio = nombre === 'costoUnitario' || nombre === 'valorVentaUnitario' ? 'precio' : nombre
    if (['productoId', 'descripcion', 'cantidad', 'precio', 'tipoMovimiento'].includes(propio)) {
      return `lineas.${Number.parseInt(indice, 10)}.${propio}` as CampoFormulario
    }
    return null
  }
  if (campoApi === 'terceroId') return 'tercero'
  return (CAMPOS_SIMPLES as readonly string[]).includes(campoApi) ? (campoApi as CampoFormulario) : null
}

const enCampos = (campos: ErrorDeCampo[], mensaje: string | null = null): UbicacionError => ({ tipo: 'formulario', mensaje, campos })

/** Índices de línea que señala el detalle (`linea`, `indice` o `lineas: [..]`), si los trae. */
function lineasDelDetalle(error: ErrorApi, total: number): number[] {
  const d = error.detalle ?? {}
  const candidatos = [d.linea, d.indice, ...(Array.isArray(d.lineas) ? d.lineas : [])]
  return candidatos.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < total)
}

function duplicado(error: ErrorApi, ctx: ContextoError): UbicacionError {
  const { naturaleza, valores } = ctx
  if (naturaleza === 'COMPRA' || naturaleza === 'VENTA') {
    const tipo = valores.tipoComprobante === '03' ? 'la boleta' : 'la factura'
    const tercero = naturaleza === 'COMPRA' ? 'este proveedor' : 'este cliente'
    const documento = formatearDocumento(valores.serie.toUpperCase(), valores.numero)
    return enCampos([{ campo: 'numero', mensaje: `Ya existe ${tipo} ${documento} de ${tercero}.` }])
  }
  if (naturaleza === 'MERMA' && valores.tipoOperacion === '13') {
    return enCampos([{ campo: 'anioInforme', mensaje: `Ya existe una merma con el informe 00-IT-${valores.anioInforme} en esa fecha.` }])
  }
  return enCampos([], mensajeDeError(error))
}

export function ubicarErrorOperacion(error: unknown, ctx: ContextoError): UbicacionError {
  if (!(error instanceof ErrorApi)) return enCampos([], mensajeDeError(error))
  const { valores } = ctx
  // Detalle con la fecha del formulario por si la API no la trae (el mes cerrado se nombra según la fecha).
  const conFecha = (e: ErrorApi) => new ErrorApi(e.status, e.codigo, e.message, { fecha: valores.fecha, ...e.detalle }, e.requestId)

  switch (error.codigo) {
    case 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION':
      return { tipo: 'confirmar', detalle: leerDetalleStockNegativo(error.detalle) }
    case 'ORDEN_EN_CONFLICTO':
      return { tipo: 'reintentar', mensaje: mensajeDeError(error) }
    case 'STOCK_INSUFICIENTE': {
      const { productoId } = leerDetalleStockNegativo(error.detalle)
      const producto = productoId !== null ? ctx.nombreProducto(productoId) : null
      const detalle = producto ? { ...error.detalle, producto } : error.detalle
      return enCampos([], mensajeDeError(new ErrorApi(error.status, error.codigo, error.message, detalle, error.requestId)))
    }
    case 'PERIODO_CERRADO':
      return enCampos([{ campo: 'fecha', mensaje: 'Ese mes está cerrado.' }], mensajeDeError(conFecha(error)))
    case 'SALDO_INICIAL_INEXISTENTE':
      return enCampos([{ campo: 'fecha', mensaje: mensajeDeError(conFecha(error)) }])
    case 'COMPROBANTE_DUPLICADO':
      return duplicado(error, ctx)
    case 'COMPROBANTE_ANULADO':
      return { tipo: 'formulario', mensaje: mensajeDeError(error), campos: [], soloLectura: true }
    case 'PRECIO_VENTA_REQUERIDO': {
      const total = valores.lineas.length
      let indices = lineasDelDetalle(error, total)
      if (indices.length === 0) indices = valores.lineas.flatMap((l, i) => (l.precio.trim() === '' ? [i] : []))
      if (indices.length === 0) indices = valores.lineas.map((_, i) => i)
      return enCampos(indices.map((i) => ({ campo: `lineas.${i}.precio` as CampoFormulario, mensaje: 'Indica el valor de venta sin IGV.' })))
    }
    case 'TIPO_CAMBIO_REQUERIDO':
      return enCampos([{ campo: 'tipoCambio', mensaje: mensajeDeError(error) }])
    case 'SUSTENTO_REQUERIDO':
      return enCampos([{ campo: 'sustento', mensaje: mensajeDeError(error) }])
    case 'TERCERO_INEXISTENTE':
      return enCampos([{ campo: 'tercero', mensaje: mensajeDeError(error) }])
    case 'ESTABLECIMIENTO_INEXISTENTE':
      return enCampos([{ campo: 'establecimientoId', mensaje: mensajeDeError(error) }])
    case 'SIN_PERMISO':
      return enCampos([], ctx.edicion && ctx.soloAsistente ? MENSAJE_ASISTENTE_SIN_PERMISO : mensajeDeError(error))
    case 'VALIDACION': {
      const campos: ErrorDeCampo[] = []
      let sinUbicar = false
      for (const [campoApi, mensaje] of Object.entries(camposConError(error))) {
        const campo = campoDelFormulario(campoApi)
        if (campo) campos.push({ campo, mensaje })
        else sinUbicar = true
      }
      return enCampos(campos, sinUbicar || campos.length === 0 ? mensajeDeError(error) : null)
    }
    default:
      return enCampos([], mensajeDeError(error))
  }
}
