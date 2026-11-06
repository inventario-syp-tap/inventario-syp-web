// Configuración (docs/CONTRATO-API.md §6.2). PATCH por secciones (la API las fusiona):
// ADMIN todas; CONTADOR solo `libro` y `winconta` (otra sección → 403 SIN_PERMISO).
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'

export type Configuracion = components['schemas']['ConfiguracionDto']
export type CambiosConfiguracion = components['schemas']['ActualizarConfiguracionDto']
export type LibroModo = components['schemas']['LibroModoDto']
export type ModoLibro = LibroModo['modo']

export const obtenerConfiguracion = () => solicitar<Configuracion>('/configuracion')

export const actualizarConfiguracion = (cambios: CambiosConfiguracion) =>
  solicitar<Configuracion>('/configuracion', { metodo: 'PATCH', cuerpo: cambios })

export const obtenerLibroModo = (anio: number) => solicitar<LibroModo>(`/configuracion/libro-modo/${anio}`)

export const fijarLibroModo = (anio: number, modo: ModoLibro) =>
  solicitar<LibroModo>(`/configuracion/libro-modo/${anio}`, { metodo: 'PUT', cuerpo: { modo } })

export function useConfiguracion() {
  return useQuery({ queryKey: CLAVES.configuracion, queryFn: obtenerConfiguracion })
}

export function useLibroModo(anio: number) {
  return useQuery({ queryKey: [...CLAVES.configuracion, 'libro-modo', anio], queryFn: () => obtenerLibroModo(anio) })
}
