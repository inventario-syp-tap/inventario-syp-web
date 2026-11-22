// Control de tonelaje (docs/CONTRATO-API.md §6.6): por mes, las toneladas que reporta una fuente externa frente a
// las compras del kardex, con la diferencia que calcula la API. Ver y descargar Excel: todos · registrar o
// reemplazar el reporte del mes (PUT, por fuente): A, C.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type ControlTonelaje = components['schemas']['ControlTonelajeDto']
export type MesTonelaje = components['schemas']['MesTonelajeDto']
export type ReporteTonelaje = components['schemas']['ReporteTonelajeDto']
export type DatosRegistrarTonelaje = components['schemas']['RegistrarTonelajeDto']

/** Fuente por defecto (D-25: sin nombres de personas). */
export const FUENTE_POR_DEFECTO = 'REPORTE EXTERNO'

export const consultarControlTonelaje = (anio: number) => solicitar<ControlTonelaje>(`/control-tonelaje${consultaUrl({ anio })}`)

export const rutaExcelControlTonelaje = (anio: number) => `/control-tonelaje${consultaUrl({ anio, formato: 'xlsx' })}`

export const registrarTonelaje = (anio: number, mes: number, datos: DatosRegistrarTonelaje) =>
  solicitar<MesTonelaje>(`/control-tonelaje/${anio}/${mes}`, { metodo: 'PUT', cuerpo: datos })

export function useControlTonelaje(anio: number) {
  return useQuery({ queryKey: [...CLAVES.controlTonelaje, anio], queryFn: () => consultarControlTonelaje(anio) })
}
