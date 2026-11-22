// Asientos del mes y exportación a WinConta (docs/CONTRATO-API.md §6.6). Ver: todos · exportar: A, C (solo meses
// CERRADOS; la API valida número de 4 dígitos y tipo de cambio > 0 con hasta 3 decimales). Los importes y si se
// puede exportar los decide la API: la web solo los muestra.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import { descargarArchivoPost } from './descargas'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type AsientosMes = components['schemas']['AsientosMesDto']
export type Asiento = components['schemas']['AsientoDto']
export type LineaAsiento = components['schemas']['LineaAsientoDto']
export type ImporteRegla = components['schemas']['ImporteReglaDto']
export type MovimientoSinRegla = components['schemas']['MovimientoSinReglaDto']
export type TipoAsiento = Asiento['tipoAsiento']
export type EstadoExportacion = components['schemas']['ExportacionVigenteDto']['estado']
export type AsientoExportado = components['schemas']['AsientoExportadoDto']
export type AsientosExportados = components['schemas']['AsientosExportadosDto']
export type DatosExportarWinConta = components['schemas']['ExportarWinContaDto']
export type EstadoAsientoMes = components['schemas']['EstadoAsientoMesDto']['estado']

export const NOMBRE_TIPO_ASIENTO: Record<TipoAsiento, string> = {
  COSTO_VENTAS: 'Costo de ventas',
  MERMA: 'Merma',
  DESMEDRO: 'Desmedro',
  AJUSTE_FALTANTE: 'Ajuste faltante',
  AJUSTE_SOBRANTE: 'Ajuste sobrante',
}

/** Pestañas de la pantalla (docs/UI-UX.md §5.13): Ajustes reúne faltante y sobrante. */
export const GRUPOS_ASIENTO: readonly { id: string; titulo: string; tipos: readonly TipoAsiento[] }[] = [
  { id: 'costo-ventas', titulo: 'Costo de ventas', tipos: ['COSTO_VENTAS'] },
  { id: 'mermas', titulo: 'Mermas', tipos: ['MERMA'] },
  { id: 'desmedros', titulo: 'Desmedros', tipos: ['DESMEDRO'] },
  { id: 'ajustes', titulo: 'Ajustes', tipos: ['AJUSTE_FALTANTE', 'AJUSTE_SOBRANTE'] },
]

export const consultarAsientos = (anio: number, mes: number) => solicitar<AsientosMes>(`/asientos${consultaUrl({ anio, mes })}`)

export const consultarExportados = (anio: number) => solicitar<AsientosExportados>(`/asientos/exportados${consultaUrl({ anio })}`)

/** Nombre si la API no manda Content-Disposition. */
export const nombreArchivoWinConta = (datos: Pick<DatosExportarWinConta, 'anio' | 'mes' | 'tipoAsiento'>) =>
  `winconta_${datos.tipoAsiento.toLowerCase().replaceAll('_', '-')}_${datos.anio}-${String(datos.mes).padStart(2, '0')}.xlsx`

/** Descarga el .xlsx de WinConta (POST: la API registra la exportación). Devuelve el nombre del archivo. */
export const exportarWinConta = (datos: DatosExportarWinConta) =>
  descargarArchivoPost('/asientos/winconta', datos, nombreArchivoWinConta(datos))

export function useAsientos(anio: number, mes: number) {
  return useQuery({ queryKey: [...CLAVES.asientos, anio, mes], queryFn: () => consultarAsientos(anio, mes) })
}

export function useAsientosExportados(anio: number) {
  return useQuery({ queryKey: [...CLAVES.asientos, 'exportados', anio], queryFn: () => consultarExportados(anio) })
}
