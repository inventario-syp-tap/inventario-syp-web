// 409 CIERRE_CON_SALDO_CERO_CON_COSTO: la API rechaza el cierre y la pantalla lista esos movimientos con un enlace
// al kardex (docs/UI-UX.md §5.9). Desde el S10 el OpenAPI documenta el detalle (ErrorSaldoCeroDto): `detalle.periodo`
// y `detalle.movimientos[]` con movimientoId, productoId, productoCodigo, fecha, orden y saldoCosto. Si una versión
// anterior de la API no lo manda, se usan las alertas SALDO_CERO_CON_COSTO del mes (GET /kardex/alertas).
import type { Alerta } from '@/api/kardex'
import type { components } from '@/api/esquema'
import { anioMesDeFecha } from '@/api/periodos'
import { ErrorApi } from '@/lib/errores'

type DetalleSaldoCero = components['schemas']['DetalleSaldoCeroDto']
type MovimientoSaldoCeroApi = components['schemas']['MovimientoSaldoCeroDto']

export type MovimientoSaldoCero = {
  movimientoId: string | null
  productoId: number | null
  productoCodigo: string | null
  fecha: string | null
  documento: string | null
}

const esMovimiento = (item: unknown): item is MovimientoSaldoCeroApi =>
  !!item && typeof item === 'object'
  && typeof (item as MovimientoSaldoCeroApi).movimientoId === 'string'
  && typeof (item as MovimientoSaldoCeroApi).productoId === 'number'

/** El `detalle` tipado del 409, o null si el error no es ese o no trae la lista. */
export function detalleSaldoCero(error: unknown): DetalleSaldoCero | null {
  if (!(error instanceof ErrorApi) || error.codigo !== 'CIERRE_CON_SALDO_CERO_CON_COSTO') return null
  const movimientos = error.detalle?.movimientos
  if (!Array.isArray(movimientos)) return null
  const periodo = typeof error.detalle?.periodo === 'string' ? error.detalle.periodo : ''
  return { periodo, movimientos: movimientos.filter(esMovimiento) }
}

export function leerMovimientosSaldoCero(error: unknown): MovimientoSaldoCero[] {
  return (detalleSaldoCero(error)?.movimientos ?? []).map((m) => ({
    movimientoId: m.movimientoId, productoId: m.productoId, productoCodigo: m.productoCodigo, fecha: m.fecha, documento: null,
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
