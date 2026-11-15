// Filtros del kardex en la URL (?producto=1&anio=2026&mes=3&detallado=1), no en localStorage: se pueden compartir,
// recargar y volver atrás. Sin `mes` se usa el mes en curso; `mes=todo` es "Todo el año".
import type { FilaKardex } from '@/api/kardex'
import { RAIZ_MODULO } from '@/app/paginas'
import { documentoComprobante } from '@/funcionalidades/comprobantes/esquemas'
import { hoyIso } from '@/lib/formato'

export type FiltrosKardexUrl = {
  productoId: number | null
  anio: number
  /** null = Todo el año. */
  mes: number | null
  detallado: boolean
}

const entero = (texto: string | null, minimo: number, maximo: number): number | null => {
  if (!texto || !/^\d+$/.test(texto)) return null
  const valor = Number.parseInt(texto, 10)
  return valor >= minimo && valor <= maximo ? valor : null
}

export function leerFiltrosKardex(parametros: URLSearchParams): FiltrosKardexUrl {
  const hoy = hoyIso()
  const anioActual = Number.parseInt(hoy.slice(0, 4), 10)
  const anio = entero(parametros.get('anio'), 2000, 2100) ?? anioActual
  const textoMes = parametros.get('mes')
  const mes = textoMes === 'todo'
    ? null
    : entero(textoMes, 1, 12) ?? (anio === anioActual ? Number.parseInt(hoy.slice(5, 7), 10) : null)
  return {
    productoId: entero(parametros.get('producto'), 1, Number.MAX_SAFE_INTEGER),
    anio,
    mes,
    detallado: parametros.get('detallado') === '1',
  }
}

export function escribirFiltrosKardex(filtros: FiltrosKardexUrl): URLSearchParams {
  const parametros = new URLSearchParams()
  if (filtros.productoId !== null) parametros.set('producto', String(filtros.productoId))
  parametros.set('anio', String(filtros.anio))
  parametros.set('mes', filtros.mes === null ? 'todo' : String(filtros.mes))
  if (filtros.detallado) parametros.set('detallado', '1')
  return parametros
}

/** Enlace a una fila del kardex (desde las alertas, Periodos o el cierre): `?producto&anio&mes#fila-<id>`. */
export function enlaceKardex(productoId: number, anio: number, mes: number | null, movimientoId?: string | null): string {
  const busqueda = escribirFiltrosKardex({ productoId, anio, mes, detallado: false }).toString()
  return `${RAIZ_MODULO}/kardex?${busqueda}${movimientoId ? `#fila-${movimientoId}` : ''}`
}

/** Documento de una fila del kardex como en Comprobantes: F001-0000123 o 00-IT-2026. */
export const documentoFila = (fila: FilaKardex) => documentoComprobante(fila)
