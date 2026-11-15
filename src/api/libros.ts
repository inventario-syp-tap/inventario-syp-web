// Libros 12.1 (unidades físicas) y 13.1 (valorizado) (docs/CONTRATO-API.md §6.5). Ver: todos · registrar impresión
// y prueba de márgenes: A, C · 13.1 detallado: A, C (D-33). La API arma el libro: aquí solo se pide y se muestra
// (las cifras del 12.1 llegan redondeadas como se imprimen).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type Libro121 = components['schemas']['Libro121Dto']
export type BloqueLibro121 = components['schemas']['BloqueLibro121Dto']
export type ModoLibro = Libro121['modo']
export type ImpresionLibro121 = components['schemas']['ImpresionLibro121Dto']
export type ImpresionesLibro121 = components['schemas']['ImpresionesLibro121Dto']
export type EstadoLibro121 = components['schemas']['EstadoLibroMesDto']['estado']
export type DatosRegistrarImpresion = components['schemas']['RegistrarImpresionDto']

/** Filtros comunes de los libros: sin `mes`, el año completo; sin `productoId`, todos los productos. */
export type FiltrosLibro = { anio: number; mes?: number; productoId?: number }

const consultaLibro = ({ anio, mes, productoId }: FiltrosLibro, extra: Record<string, string | undefined> = {}) =>
  consultaUrl({ anio, mes, productoId, ...extra })

export const consultarLibro121 = (filtros: FiltrosLibro) => solicitar<Libro121>(`/libros/12-1${consultaLibro(filtros)}`)

export const consultarImpresiones121 = (anio: number) =>
  solicitar<ImpresionesLibro121>(`/libros/12-1/impresiones${consultaUrl({ anio })}`)

export const registrarImpresion121 = (datos: DatosRegistrarImpresion) =>
  solicitar<ImpresionLibro121>('/libros/12-1/impresiones', { metodo: 'POST', cuerpo: datos })

/** Rutas de descarga (BotonDescarga). */
export const rutaPdfLibro121 = (filtros: FiltrosLibro) => `/libros/12-1${consultaLibro(filtros, { formato: 'pdf' })}`
export const RUTA_PRUEBA_MARGENES = '/libros/12-1/prueba-margenes'
export const rutaLibro131 = (filtros: FiltrosLibro & { detallado?: boolean }, formato: 'pdf' | 'xlsx') =>
  `/libros/13-1${consultaLibro(filtros, { detallado: filtros.detallado ? 'true' : undefined, formato })}`

export function useLibro121(filtros: FiltrosLibro) {
  return useQuery({ queryKey: [...CLAVES.libro121, 'libro', filtros], queryFn: () => consultarLibro121(filtros) })
}

export function useImpresiones121(anio: number) {
  return useQuery({ queryKey: [...CLAVES.libro121, 'impresiones', anio], queryFn: () => consultarImpresiones121(anio) })
}

/** Registrar impresión: luego se invalidan periodos (tarjetas), el libro 12.1 (estado e historial) y el dashboard. */
export function useRegistrarImpresion121() {
  const clienteConsultas = useQueryClient()
  return useMutation({
    mutationFn: registrarImpresion121,
    onSuccess: () => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.periodos })
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.libro121 })
      // El dashboard (S12) mostrará la alerta "libro sin imprimir".
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.dashboard })
    },
  })
}

export const TEXTO_ESTADO_LIBRO: Record<EstadoLibro121, string> = {
  PENDIENTE: 'Pendiente',
  IMPRESO: 'Impreso',
  DESACTUALIZADO: 'Impresión desactualizada: vuelve a imprimir',
}
