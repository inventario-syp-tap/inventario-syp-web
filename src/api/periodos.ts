// Periodos y cierre anual (docs/CONTRATO-API.md §6.4). Ver: todos · cerrar y reabrir: A, C · cerrar en bloque: A ·
// cierre anual: A, C. La API decide qué se puede cerrar o reabrir; la web solo oculta lo que no corresponde.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type Periodo = components['schemas']['PeriodoDto']
export type PeriodosAnio = components['schemas']['PeriodosAnioDto']
export type EstadoPeriodo = Periodo['estado']
export type ResultadoCierre = components['schemas']['ResultadoCierreDto']
export type ResultadoBloque = components['schemas']['ResultadoBloqueDto']
export type ResultadoReapertura = components['schemas']['ResultadoReaperturaDto']
export type DatosCerrarEnBloque = components['schemas']['CerrarEnBloqueDto']
export type VistaCierreAnual = components['schemas']['CierreAnualVistaDto']
export type SaldoCierreAnual = components['schemas']['SaldoCierreAnualDto']
export type DatosCierreAnual = components['schemas']['CierreAnualDto']
export type ResultadoCierreAnual = components['schemas']['ResultadoCierreAnualDto']

export const listarPeriodos = (anio: number) => solicitar<PeriodosAnio>(`/periodos${consultaUrl({ anio })}`)

export const cerrarPeriodo = (anio: number, mes: number) =>
  solicitar<ResultadoCierre>(`/periodos/${anio}/${mes}/cerrar`, { metodo: 'POST' })

export const reabrirPeriodo = (anio: number, mes: number, motivo: string) =>
  solicitar<ResultadoReapertura>(`/periodos/${anio}/${mes}/reabrir`, { metodo: 'POST', cuerpo: { motivo } })

export const cerrarEnBloque = (datos: DatosCerrarEnBloque) =>
  solicitar<ResultadoBloque>('/periodos/cerrar-en-bloque', { metodo: 'POST', cuerpo: datos })

export const vistaPreviaCierreAnual = (anio: number) =>
  solicitar<VistaCierreAnual>(`/periodos/${anio}/cierre-anual/vista-previa`)

export const confirmarCierreAnual = (anio: number, datos: DatosCierreAnual) =>
  solicitar<ResultadoCierreAnual>(`/periodos/${anio}/cierre-anual`, { metodo: 'POST', cuerpo: datos })

export function usePeriodos(anio: number | null) {
  return useQuery({
    queryKey: [...CLAVES.periodos, anio],
    queryFn: () => listarPeriodos(anio as number),
    enabled: anio !== null,
    staleTime: 60_000,
  })
}

export function useVistaCierreAnual(anio: number) {
  return useQuery({ queryKey: [...CLAVES.periodos, 'cierre-anual', anio], queryFn: () => vistaPreviaCierreAnual(anio) })
}

/** "2026-03-15" → { anio: 2026, mes: 3 } (partiendo el texto; null si no es una fecha completa). */
export function anioMesDeFecha(fecha: string | null | undefined): { anio: number; mes: number } | null {
  const partes = /^(\d{4})-(\d{2})-\d{2}$/.exec(fecha ?? '')
  if (!partes) return null
  const mes = Number.parseInt(partes[2], 10)
  return mes >= 1 && mes <= 12 ? { anio: Number.parseInt(partes[1], 10), mes } : null
}

/**
 * Estado del mes de una fecha según GET /periodos?anio (comparte la caché con la pantalla Periodos).
 * null mientras carga, si la fecha está incompleta o si la consulta falla: en esos casos manda la API al guardar.
 */
export function useEstadoMes(fecha: string | null | undefined): { anio: number; mes: number; estado: EstadoPeriodo } | null {
  const partes = anioMesDeFecha(fecha)
  const consulta = usePeriodos(partes?.anio ?? null)
  const periodo = partes ? consulta.data?.meses.find((m) => m.mes === partes.mes) : undefined
  return partes && periodo ? { ...partes, estado: periodo.estado } : null
}
