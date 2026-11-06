// Pantallas que se cargan bajo demanda (React.lazy) desde el S7: el paquete inicial solo trae login y layout.
import { lazy } from 'react'
import { Skeleton } from '@/componentes/ui/skeleton'

export const PaginaProductos = lazy(() => import('@/funcionalidades/maestros/productos/pagina-productos').then((m) => ({ default: m.PaginaProductos })))
export const PaginaTerceros = lazy(() => import('@/funcionalidades/maestros/terceros/pagina-terceros').then((m) => ({ default: m.PaginaTerceros })))
export const PaginaReglas = lazy(() => import('@/funcionalidades/maestros/reglas-contables/pagina-reglas').then((m) => ({ default: m.PaginaReglas })))
export const PaginaEstablecimientos = lazy(() =>
  import('@/funcionalidades/maestros/establecimientos/pagina-establecimientos').then((m) => ({ default: m.PaginaEstablecimientos })))
export const PaginaConfiguracion = lazy(() => import('@/funcionalidades/configuracion/pagina-configuracion').then((m) => ({ default: m.PaginaConfiguracion })))
export const PaginaUsuarios = lazy(() => import('@/funcionalidades/usuarios/pagina-usuarios').then((m) => ({ default: m.PaginaUsuarios })))

/** Mientras llega el código de la pantalla: esqueleto (nunca en blanco, docs/UI-UX.md §6). */
export function CargandoPantalla() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Cargando la pantalla…</span>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
