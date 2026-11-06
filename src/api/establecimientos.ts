// Establecimientos (docs/CONTRATO-API.md §6.2). Ver: todos · crear y editar: solo ADMIN. El código no cambia.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'

export type Establecimiento = components['schemas']['EstablecimientoDto']
export type DatosCrearEstablecimiento = components['schemas']['CrearEstablecimientoDto']
export type DatosEditarEstablecimiento = components['schemas']['EditarEstablecimientoDto']

export const listarEstablecimientos = () => solicitar<Establecimiento[]>('/establecimientos')

export const crearEstablecimiento = (datos: DatosCrearEstablecimiento) =>
  solicitar<Establecimiento>('/establecimientos', { metodo: 'POST', cuerpo: datos })

export const editarEstablecimiento = (id: number, datos: DatosEditarEstablecimiento) =>
  solicitar<Establecimiento>(`/establecimientos/${id}`, { metodo: 'PATCH', cuerpo: datos })

export function useEstablecimientos() {
  return useQuery({ queryKey: CLAVES.establecimientos, queryFn: listarEstablecimientos })
}
