// 409 CIERRE_CON_SALDO_CERO_CON_COSTO: la API rechaza el cierre y la pantalla lista esos movimientos con un enlace
// al kardex (docs/UI-UX.md §5.9). El OpenAPI aún no documenta la forma del `detalle` (pendiente para la API del S10),
// así que se lee sin suponer nada: `detalle.movimientos` (o `filas`) con movimientoId, productoId/productoCodigo y
// fecha. Si no viene, se usan las alertas SALDO_CERO_CON_COSTO del mes (GET /kardex/alertas).
import type { Alerta } from '@/api/kardex'
import { anioMesDeFecha } from '@/api/periodos'
import { ErrorApi } from '@/lib/errores'

export type MovimientoSaldoCero = {
  movimientoId: string | null
  productoId: number | null
  productoCodigo: string | null
  fecha: string | null
  documento: string | null
}

const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() !== '' ? valor : null)
const entero = (valor: unknown) => {
  const numero = typeof valor === 'number' ? valor : Number.parseInt(texto(valor) ?? '', 10)
  return Number.isInteger(numero) ? numero : null
}

export function leerMovimientosSaldoCero(error: unknown): MovimientoSaldoCero[] {
  if (!(error instanceof ErrorApi)) return []
  const detalle = error.detalle ?? {}
  const lista = Array.isArray(detalle.movimientos) ? detalle.movimientos : Array.isArray(detalle.filas) ? detalle.filas : []
  return lista
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      movimientoId: texto(item.movimientoId) ?? texto(item.id),
      productoId: entero(item.productoId),
      productoCodigo: texto(item.productoCodigo) ?? texto(item.producto),
      fecha: texto(item.fecha),
      documento: texto(item.documento),
    }))
}

/** Respaldo: alertas SALDO_CERO_CON_COSTO del año y mes indicados. */
export function saldoCeroDesdeAlertas(alertas: readonly Alerta[], anio: number, mes: number): MovimientoSaldoCero[] {
  return alertas
    .filter((a) => a.tipo === 'SALDO_CERO_CON_COSTO' && a.anio === anio && (anioMesDeFecha(a.fecha)?.mes ?? a.mes) === mes)
    .map((a) => ({
      movimientoId: a.movimientoId, productoId: a.productoId, productoCodigo: a.productoCodigo, fecha: a.fecha, documento: a.documento,
    }))
}
