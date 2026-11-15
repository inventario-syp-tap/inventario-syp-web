// React Router 8 en modo datos (docs/UI-UX.md §3). Todo el módulo cuelga de /inventario.
// Las pantallas desde el S7 se cargan bajo demanda (pantallas-diferidas.tsx).
import { Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { LayoutApp, type DatosRuta } from './layout/layout-app'
import { PaginaNoEncontrada } from './pagina-no-encontrada'
import { INICIO, PAGINAS_DEL_MODULO, RAIZ_MODULO } from './paginas'
import {
  CargandoPantalla, PaginaAjuste, PaginaCierreAnual, PaginaCompra, PaginaComprobantes, PaginaConfiguracion,
  PaginaDetalleComprobante, PaginaEstablecimientos, PaginaExcelContadora, PaginaKardex, PaginaLibro121, PaginaLibro131, PaginaMerma,
  PaginaPeriodos, PaginaProductos, PaginaReglas, PaginaReporte, PaginaSaldosIniciales, PaginaTerceros, PaginaUsuarios, PaginaVenta,
} from './pantallas-diferidas'
import { RaizApp } from './raiz-app'
import { RutaProtegida } from './ruta-protegida'
import { EnConstruccion } from '@/componentes/comunes/en-construccion'
import { PaginaCambiarPassword } from '@/funcionalidades/auth/pagina-cambiar-password'
import { PaginaLogin } from '@/funcionalidades/auth/pagina-login'
import { PaginaInicio } from '@/funcionalidades/dashboard/pagina-inicio'
import { PaginaImportacion } from '@/funcionalidades/importacion/pagina-importacion'

const relativa = (ruta: string) => ruta.slice(RAIZ_MODULO.length + 1)

const diferida = (pantalla: ReactNode) => <Suspense fallback={<CargandoPantalla />}>{pantalla}</Suspense>

/** Pantallas ya implementadas, por ruta completa. Las demás muestran "En construcción". */
const PANTALLAS: Record<string, ReactNode> = {
  [`${RAIZ_MODULO}/configuracion/importacion`]: <PaginaImportacion />,
  [`${RAIZ_MODULO}/maestros/productos`]: diferida(<PaginaProductos />),
  [`${RAIZ_MODULO}/maestros/terceros`]: diferida(<PaginaTerceros />),
  [`${RAIZ_MODULO}/maestros/reglas-contables`]: diferida(<PaginaReglas />),
  [`${RAIZ_MODULO}/maestros/establecimientos`]: diferida(<PaginaEstablecimientos />),
  [`${RAIZ_MODULO}/configuracion`]: diferida(<PaginaConfiguracion />),
  [`${RAIZ_MODULO}/configuracion/usuarios`]: diferida(<PaginaUsuarios />),
  [`${RAIZ_MODULO}/compras/nueva`]: diferida(<PaginaCompra />),
  [`${RAIZ_MODULO}/ventas/nueva`]: diferida(<PaginaVenta />),
  [`${RAIZ_MODULO}/mermas/nueva`]: diferida(<PaginaMerma />),
  [`${RAIZ_MODULO}/ajustes/nuevo`]: diferida(<PaginaAjuste />),
  [`${RAIZ_MODULO}/comprobantes`]: diferida(<PaginaComprobantes />),
  [`${RAIZ_MODULO}/comprobantes/:id`]: diferida(<PaginaDetalleComprobante />),
  [`${RAIZ_MODULO}/kardex`]: diferida(<PaginaKardex />),
  [`${RAIZ_MODULO}/periodos`]: diferida(<PaginaPeriodos />),
  [`${RAIZ_MODULO}/periodos/cierre-anual`]: diferida(<PaginaCierreAnual />),
  [`${RAIZ_MODULO}/saldos-iniciales`]: diferida(<PaginaSaldosIniciales />),
  [`${RAIZ_MODULO}/libros/12-1`]: diferida(<PaginaLibro121 />),
  [`${RAIZ_MODULO}/libros/13-1`]: diferida(<PaginaLibro131 />),
  // /reportes/:reporte: una ruta por reporte (las del menú); otra cualquiera cae en "Página no encontrada".
  [`${RAIZ_MODULO}/reportes/toneladas`]: diferida(<PaginaReporte key="toneladas" tipo="toneladas" />),
  [`${RAIZ_MODULO}/reportes/costo-ventas`]: diferida(<PaginaReporte key="costo-ventas" tipo="costo-ventas" />),
  [`${RAIZ_MODULO}/reportes/resumen-anual`]: diferida(<PaginaReporte key="resumen-anual" tipo="resumen-anual" />),
  [`${RAIZ_MODULO}/reportes/margen`]: diferida(<PaginaReporte key="margen" tipo="margen" />),
  [`${RAIZ_MODULO}/reportes/excel-contadora`]: diferida(<PaginaExcelContadora />),
}

export const rutas: RouteObject[] = [
  {
    element: <RaizApp />,
    children: [
      { path: '/login', element: <PaginaLogin /> },
      {
        path: '/cambiar-password',
        element: (
          <RutaProtegida permitirCambioPendiente>
            <PaginaCambiarPassword />
          </RutaProtegida>
        ),
      },
      { path: '/', element: <Navigate to={RAIZ_MODULO} replace /> },
      {
        path: RAIZ_MODULO,
        element: (
          <RutaProtegida>
            <LayoutApp />
          </RutaProtegida>
        ),
        children: [
          {
            index: true,
            handle: { titulo: INICIO.titulo } satisfies DatosRuta,
            element: <RutaProtegida roles={INICIO.roles}><PaginaInicio /></RutaProtegida>,
          },
          ...PAGINAS_DEL_MODULO.map((pagina) => ({
            path: relativa(pagina.ruta),
            handle: { titulo: pagina.titulo } satisfies DatosRuta,
            element: (
              <RutaProtegida roles={pagina.roles}>
                {PANTALLAS[pagina.ruta] ?? <EnConstruccion titulo={pagina.titulo} sprint={pagina.sprint} />}
              </RutaProtegida>
            ),
          })),
        ],
      },
      { path: '*', element: <PaginaNoEncontrada /> },
    ],
  },
]

export const router = createBrowserRouter(rutas)
