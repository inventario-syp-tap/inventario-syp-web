// Reportes por año (docs/CONTRATO-API.md §6.5): Toneladas, Costo de ventas, Resumen anual y Margen, cada uno en JSON
// (tabla en pantalla) y en Excel; y el Excel formato contadora (A, C). Los totales los calcula y nombra la API.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type Toneladas = components['schemas']['ToneladasDto']
export type ToneladasMes = components['schemas']['ToneladasMesDto']
export type CostoVentas = components['schemas']['CostoVentasDto']
export type CostoVentasMes = components['schemas']['CostoVentasMesDto']
export type ResumenAnual = components['schemas']['ResumenAnualDto']
export type ResumenAnualFila = components['schemas']['ResumenAnualFilaDto']
export type Margen = components['schemas']['MargenDto']
export type MargenMes = components['schemas']['MargenMesDto']

export type TipoReporte = 'toneladas' | 'costo-ventas' | 'resumen-anual' | 'margen'

type DatosReporte = {
  toneladas: Toneladas
  'costo-ventas': CostoVentas
  'resumen-anual': ResumenAnual
  margen: Margen
}

export const TITULO_REPORTE: Record<TipoReporte, string> = {
  toneladas: 'Toneladas',
  'costo-ventas': 'Costo de ventas',
  'resumen-anual': 'Resumen anual',
  margen: 'Margen',
}

export const consultarReporte = <T extends TipoReporte>(tipo: T, anio: number) =>
  solicitar<DatosReporte[T]>(`/reportes/${tipo}${consultaUrl({ anio })}`)

export const rutaExcelReporte = (tipo: TipoReporte, anio: number) => `/reportes/${tipo}${consultaUrl({ anio, formato: 'xlsx' })}`
export const rutaExcelContadora = (anio: number) => `/reportes/excel-contadora${consultaUrl({ anio })}`

export function useReporte<T extends TipoReporte>(tipo: T, anio: number) {
  return useQuery({ queryKey: [...CLAVES.reportes, tipo, anio], queryFn: () => consultarReporte(tipo, anio) })
}
