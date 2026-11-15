// Kardex valorizado (docs/CONTRATO-API.md §6.4). Ver: todos · reordenar (mover): A, C · recalcular: A.
// La API calcula costos y saldos: aquí solo se piden y se muestran (cantidades y costos llegan como string).
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { ResultadoEscritura } from './comprobantes'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type Kardex = components['schemas']['KardexDto']
export type MesKardex = components['schemas']['MesKardexDto']
export type FilaKardex = components['schemas']['FilaKardexDto']
export type SaldoKardex = components['schemas']['SaldoKardexDto']
export type Alerta = components['schemas']['AlertaDto']
export type Alertas = components['schemas']['AlertasDto']
export type DatosRecalcular = components['schemas']['RecalcularKardexDto']
export type ResultadoRecalculo = components['schemas']['ResultadoRecalculoDto']
export type DatosMover = components['schemas']['MoverMovimientoDto']

export type FiltrosKardex = { productoId: number; anio: number; mes?: number }

export const consultarKardex = ({ productoId, anio, mes }: FiltrosKardex) =>
  solicitar<Kardex>(`/kardex${consultaUrl({ productoId, anio, mes })}`)

export const consultarAlertas = (anio: number) => solicitar<Alertas>(`/kardex/alertas${consultaUrl({ anio })}`)

export const recalcularKardex = (datos: DatosRecalcular) =>
  solicitar<ResultadoRecalculo>('/kardex/recalcular', { metodo: 'POST', cuerpo: datos })

/** Mueve un movimiento ↑/↓ dentro de su misma fecha (cambia el costo de las salidas de ese día). */
export const moverMovimiento = (movimientoId: string, datos: DatosMover) =>
  solicitar<ResultadoEscritura>(`/movimientos/${encodeURIComponent(movimientoId)}/mover`, { metodo: 'POST', cuerpo: datos })

export function useKardex(filtros: FiltrosKardex | null) {
  return useQuery({
    queryKey: [...CLAVES.kardex, filtros],
    queryFn: () => consultarKardex(filtros as FiltrosKardex),
    enabled: filtros !== null,
    placeholderData: keepPreviousData,
  })
}

export function useAlertasKardex(anio: number) {
  return useQuery({ queryKey: [...CLAVES.alertas, anio], queryFn: () => consultarAlertas(anio) })
}
