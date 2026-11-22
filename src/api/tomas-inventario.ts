// Tomas de inventario (docs/CONTRATO-API.md §6.6). Ver: todos · crear, resolver y cerrar: A, C.
// La API calcula el saldo del sistema a la fecha, la diferencia y si quedó desactualizada; al resolver genera la
// merma 13 y el ajuste 28 enlazados a la toma.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type Toma = components['schemas']['TomaDto']
export type LineaToma = components['schemas']['LineaTomaRespuestaDto']
export type ComprobanteToma = components['schemas']['ComprobanteTomaDto']
export type DatosCrearToma = components['schemas']['CrearTomaDto']
export type DatosResolverToma = components['schemas']['ResolverTomaDto']
export type AccionToma = components['schemas']['ResolverLineaDto']['accion']

export const listarTomas = (anio: number) => solicitar<Toma[]>(`/tomas-inventario${consultaUrl({ anio })}`)

export const obtenerToma = (id: string) => solicitar<Toma>(`/tomas-inventario/${encodeURIComponent(id)}`)

export const crearToma = (datos: DatosCrearToma) => solicitar<Toma>('/tomas-inventario', { metodo: 'POST', cuerpo: datos })

export const resolverToma = (id: string, datos: DatosResolverToma) =>
  solicitar<Toma>(`/tomas-inventario/${encodeURIComponent(id)}/resolver`, { metodo: 'POST', cuerpo: datos })

export const cerrarToma = (id: string) => solicitar<Toma>(`/tomas-inventario/${encodeURIComponent(id)}/cerrar`, { metodo: 'POST' })

export function useTomas(anio: number) {
  return useQuery({ queryKey: [...CLAVES.tomas, 'anio', anio], queryFn: () => listarTomas(anio) })
}

export function useToma(id: string | undefined) {
  return useQuery({ queryKey: [...CLAVES.tomas, 'id', id], queryFn: () => obtenerToma(id as string), enabled: !!id })
}

/** Líneas con diferencia (las que necesitan una acción al resolver). */
export const lineasConDiferencia = (toma: Pick<Toma, 'lineas'>) => toma.lineas.filter((l) => l.tipoDiferencia !== 'SIN_DIFERENCIA')

/**
 * Tomas en BORRADOR reemplazadas por otra posterior con la misma fecha (y establecimiento): la que se creó al
 * «Volver a calcular» una toma desactualizada. Devuelve, por id de la toma reemplazada, la que la reemplaza (la
 * más reciente). Compara `creadoEn` (ISO de la API) como texto: el orden alfabético coincide con el cronológico.
 */
export function tomasReemplazadas(tomas: readonly Toma[]): Map<string, Toma> {
  const resultado = new Map<string, Toma>()
  for (const toma of tomas) {
    if (toma.estado !== 'BORRADOR') continue
    let reemplazo: Toma | undefined
    for (const otra of tomas) {
      if (otra.id === toma.id || otra.fecha !== toma.fecha || otra.establecimientoId !== toma.establecimientoId) continue
      if (otra.creadoEn <= toma.creadoEn) continue
      if (!reemplazo || otra.creadoEn > reemplazo.creadoEn) reemplazo = otra
    }
    if (reemplazo) resultado.set(toma.id, reemplazo)
  }
  return resultado
}
