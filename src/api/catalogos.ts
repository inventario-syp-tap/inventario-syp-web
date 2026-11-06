// Tablas SUNAT 2, 5, 6, 10, 12 y 14 (GET /catalogos). Cambian solo con una versión nueva de la API: se cachean.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'

export type Catalogos = components['schemas']['CatalogosRespuestaDto']
export type ItemCatalogo = components['schemas']['ItemCatalogoDto']

export const obtenerCatalogos = () => solicitar<Catalogos>('/catalogos')

export function useCatalogos() {
  return useQuery({ queryKey: CLAVES.catalogos, queryFn: obtenerCatalogos, staleTime: Infinity })
}
