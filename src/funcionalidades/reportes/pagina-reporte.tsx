// Reportes por año (docs/UI-UX.md §5.12; rutas /inventario/reportes/toneladas · costo-ventas · resumen-anual · margen):
// tablas por mes parecidas a las hojas del Excel con sus totales nombrados como los devuelve la API, descarga Excel
// y, en Margen, un gráfico de barras simple. Todos ven. El año va en la URL (?anio=2026).
import { lazy, Suspense, type ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { FileSpreadsheetIcon } from 'lucide-react'
import { ReporteCostoVentas, ReporteMargen, ReporteResumenAnual, ReporteToneladas } from './tablas-reportes'
import { rutaExcelReporte, TITULO_REPORTE, useReporte, type TipoReporte } from '@/api/reportes'
import { useTituloPagina } from '@/app/titulo-pagina'
import { BotonDescarga } from '@/componentes/comunes/boton-descarga'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { Skeleton } from '@/componentes/ui/skeleton'
import { mensajeDeError } from '@/lib/errores'
import { anioDeUrl } from '@/lib/periodos'

// recharts solo se descarga al abrir Margen.
const GraficoMargen = lazy(() => import('./grafico-margen').then((m) => ({ default: m.GraficoMargen })))

const DESCRIPCION: Record<TipoReporte, string> = {
  toneladas: 'Por producto y mes: saldo inicial, compras, ventas, mermas y saldo final en toneladas.',
  'costo-ventas': 'Por producto y mes: COSTO DE VENTAS, MERMAS y TOTAL SALIDAS VALORIZADAS en soles.',
  'resumen-anual': 'Inventario inicial, compras, inventario final, costo de ventas y mermas del año por producto.',
  margen: 'Ventas en soles menos el costo de esas ventas, por producto y mes.',
}

/** Carga, error y vacío comunes; `children` recibe los datos ya tipados del reporte. */
function ConDatos<T extends { productos: readonly unknown[] }>({ consulta, anio, children }: {
  consulta: UseQueryResult<T>
  anio: number
  children: (datos: T) => ReactNode
}) {
  if (consulta.isError) return <EstadoError mensaje={mensajeDeError(consulta.error)} alReintentar={() => void consulta.refetch()} />
  if (!consulta.data) {
    return (
      <div role="status" className="flex flex-col gap-2">
        <span className="sr-only">Cargando el reporte…</span>
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }
  if (consulta.data.productos.length === 0) {
    return <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No hay datos de {anio} para este reporte.</p>
  }
  return children(consulta.data)
}

function Toneladas({ anio }: { anio: number }) {
  return <ConDatos consulta={useReporte('toneladas', anio)} anio={anio}>{(d) => <ReporteToneladas datos={d} />}</ConDatos>
}

function CostoVentas({ anio }: { anio: number }) {
  return <ConDatos consulta={useReporte('costo-ventas', anio)} anio={anio}>{(d) => <ReporteCostoVentas datos={d} />}</ConDatos>
}

function ResumenAnual({ anio }: { anio: number }) {
  return <ConDatos consulta={useReporte('resumen-anual', anio)} anio={anio}>{(d) => <ReporteResumenAnual datos={d} />}</ConDatos>
}

function MargenReporte({ anio }: { anio: number }) {
  return (
    <ConDatos consulta={useReporte('margen', anio)} anio={anio}>
      {(d) => (
        <>
          <Suspense fallback={<Skeleton className="h-72 w-full" />}>
            {/* Sin ventas con valor de venta en el año, GraficoMargen muestra un aviso en lugar del gráfico. */}
            <GraficoMargen anio={anio} meses={d.total.meses} total={d.total.total} />
          </Suspense>
          <ReporteMargen datos={d} />
        </>
      )}
    </ConDatos>
  )
}

const CONTENIDO: Record<TipoReporte, (props: { anio: number }) => ReactNode> = {
  toneladas: Toneladas,
  'costo-ventas': CostoVentas,
  'resumen-anual': ResumenAnual,
  margen: MargenReporte,
}

export function PaginaReporte({ tipo }: { tipo: TipoReporte }) {
  const titulo = TITULO_REPORTE[tipo]
  useTituloPagina(titulo)
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros)
  const Contenido = CONTENIDO[tipo]

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo={titulo}
        descripcion={DESCRIPCION[tipo]}
        acciones={(
          <BotonDescarga ruta={rutaExcelReporte(tipo, anio)} nombrePorDefecto={`${tipo}-${anio}.xlsx`}
            icono={<FileSpreadsheetIcon aria-hidden="true" />} aria-label={`Descargar Excel de ${titulo} ${anio}`}>
            Descargar Excel
          </BotonDescarga>
        )}
      />
      <SelectorPeriodo anio={anio} alCambiarAnio={(nuevo) => setParametros({ anio: String(nuevo) }, { replace: true })} />
      <Contenido anio={anio} />
    </div>
  )
}
