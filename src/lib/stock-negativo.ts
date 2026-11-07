// Detalle del 409 STOCK_NEGATIVO_REQUIERE_CONFIRMACION (docs/CONTRATO-API.md §5). El OpenAPI aún no fija su forma
// (pendiente para la API del S9): se lee sin suponer que trae todo; lo que falte se muestra como "—".
import type { Detalle } from './errores'

export type DetalleStockNegativo = {
  productoId: number | null
  fecha: string | null
  saldoResultante: string | null
  disponibleAntes: string | null
}

const textoONulo = (valor: unknown) => (typeof valor === 'string' || typeof valor === 'number' ? String(valor) : null)

export function leerDetalleStockNegativo(detalle: Detalle | undefined): DetalleStockNegativo {
  const d = detalle ?? {}
  const id = Number.parseInt(textoONulo(d.productoId) ?? '', 10)
  return {
    productoId: Number.isFinite(id) ? id : null,
    fecha: textoONulo(d.fecha),
    saldoResultante: textoONulo(d.saldoResultante),
    disponibleAntes: textoONulo(d.disponibleAntes) ?? textoONulo(d.disponible),
  }
}
