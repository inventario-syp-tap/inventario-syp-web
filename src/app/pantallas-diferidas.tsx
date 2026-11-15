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
const registro = () => import('@/funcionalidades/comprobantes/paginas-registro')
export const PaginaCompra = lazy(() => registro().then((m) => ({ default: m.PaginaCompra })))
export const PaginaVenta = lazy(() => registro().then((m) => ({ default: m.PaginaVenta })))
export const PaginaMerma = lazy(() => registro().then((m) => ({ default: m.PaginaMerma })))
export const PaginaAjuste = lazy(() => registro().then((m) => ({ default: m.PaginaAjuste })))
export const PaginaComprobantes = lazy(() => import('@/funcionalidades/comprobantes/pagina-comprobantes').then((m) => ({ default: m.PaginaComprobantes })))
export const PaginaDetalleComprobante = lazy(() =>
  import('@/funcionalidades/comprobantes/pagina-detalle-comprobante').then((m) => ({ default: m.PaginaDetalleComprobante })))
export const PaginaKardex = lazy(() => import('@/funcionalidades/kardex/pagina-kardex').then((m) => ({ default: m.PaginaKardex })))
export const PaginaPeriodos = lazy(() => import('@/funcionalidades/periodos/pagina-periodos').then((m) => ({ default: m.PaginaPeriodos })))
export const PaginaCierreAnual = lazy(() => import('@/funcionalidades/periodos/pagina-cierre-anual').then((m) => ({ default: m.PaginaCierreAnual })))
export const PaginaSaldosIniciales = lazy(() =>
  import('@/funcionalidades/saldos-iniciales/pagina-saldos-iniciales').then((m) => ({ default: m.PaginaSaldosIniciales })))
export const PaginaLibro121 = lazy(() => import('@/funcionalidades/libros/pagina-libro-12-1').then((m) => ({ default: m.PaginaLibro121 })))
export const PaginaLibro131 = lazy(() => import('@/funcionalidades/libros/pagina-libro-13-1').then((m) => ({ default: m.PaginaLibro131 })))
export const PaginaReporte = lazy(() => import('@/funcionalidades/reportes/pagina-reporte').then((m) => ({ default: m.PaginaReporte })))
export const PaginaExcelContadora = lazy(() =>
  import('@/funcionalidades/reportes/pagina-excel-contadora').then((m) => ({ default: m.PaginaExcelContadora })))

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
