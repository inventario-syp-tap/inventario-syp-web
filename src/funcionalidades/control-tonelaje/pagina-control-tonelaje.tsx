// Control de tonelaje (docs/UI-UX.md §5.14). Todos ven y descargan el Excel; A y C registran o editan las toneladas
// reportadas de cada mes y su observación. Tabla de los 12 meses: Mes · Toneladas reportadas · Fuente · Compras del
// kardex · Diferencia · Observación. Las diferencias (las marca la API con `hayDiferencia`) se resaltan con fondo
// warning suave, ícono y el texto "Diferencia": nunca solo con color. Un mes puede tener varios reportes (uno por
// fuente): cada uno en su fila.
import { Fragment } from 'react'
import { useSearchParams } from 'react-router'
import { CircleCheckIcon, FileSpreadsheetIcon, PencilIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'
import { DialogoTonelaje } from './dialogo-tonelaje'
import { rutaExcelControlTonelaje, useControlTonelaje, type MesTonelaje, type ReporteTonelaje } from '@/api/control-tonelaje'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Aviso } from '@/componentes/comunes/aviso'
import { BotonDescarga } from '@/componentes/comunes/boton-descarga'
import { Cifra } from '@/componentes/comunes/cifra'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { Button } from '@/componentes/ui/button'
import { Skeleton } from '@/componentes/ui/skeleton'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearPeriodo, nombreMes } from '@/lib/formato'
import { anioDeUrl } from '@/lib/periodos'
import { usePuede } from '@/lib/roles'

const celda = 'px-2 py-1.5 align-top'

function Diferencia({ reporte }: { reporte: ReporteTonelaje }) {
  if (reporte.diferencia === null) return <span className="text-muted-foreground">—</span>
  if (!reporte.hayDiferencia) {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        <CircleCheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        <span className="text-muted-foreground">Sin diferencia</span>
      </span>
    )
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className="inline-flex items-center gap-1 font-medium">
        <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
        Diferencia
      </span>
      <Cifra tipo="toneladas" valor={reporte.diferencia} />
    </span>
  )
}

type Edicion = { mes: MesTonelaje; reporte?: ReporteTonelaje }

export function PaginaControlTonelaje() {
  useTituloPagina('Control de tonelaje')
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros)
  const control = useControlTonelaje(anio)
  const puedeEditar = usePuede('tonelaje:editar')
  const dialogo = useDialogo<Edicion>()

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Control de tonelaje"
        descripcion="Toneladas que reporta la fuente externa frente a las compras registradas en el kardex, mes por mes."
        acciones={(
          <BotonDescarga ruta={rutaExcelControlTonelaje(anio)} nombrePorDefecto={`control-tonelaje-${anio}.xlsx`}
            icono={<FileSpreadsheetIcon aria-hidden="true" />} aria-label={`Descargar Excel del control de tonelaje ${anio}`}>
            Descargar Excel
          </BotonDescarga>
        )}
      />
      <SelectorPeriodo anio={anio} alCambiarAnio={(a) => setParametros({ anio: String(a) }, { replace: true })} />

      {control.isError ? (
        <EstadoError mensaje={mensajeDeError(control.error)} alReintentar={() => void control.refetch()} />
      ) : !control.data ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Cargando el control de tonelaje…</span>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          {control.data.mesesConDiferencia > 0 ? (
            <Aviso tono="advertencia" titulo={`${control.data.mesesConDiferencia === 1 ? '1 mes' : `${control.data.mesesConDiferencia} meses`} con diferencia en ${anio}`}>
              Revisa las filas marcadas con «Diferencia» y anota la observación.
            </Aviso>
          ) : (
            <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <CircleCheckIcon aria-hidden="true" className="size-4 text-success" />
              Ningún mes de {anio} tiene diferencia entre lo reportado y las compras del kardex.
            </p>
          )}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[56rem] text-sm">
              <caption className="sr-only">Control de tonelaje {anio}: toneladas reportadas frente a las compras del kardex por mes</caption>
              <thead className="bg-muted">
                <tr className="text-left">
                  <th scope="col" className={celda}>Mes</th>
                  <th scope="col" className={cn(celda, 'text-right')}>Toneladas reportadas (TN)</th>
                  <th scope="col" className={celda}>Fuente</th>
                  <th scope="col" className={cn(celda, 'text-right')}>Compras del kardex (TN)</th>
                  <th scope="col" className={cn(celda, 'text-right')}>Diferencia (reportado − kardex, TN)</th>
                  <th scope="col" className={celda}>Observación</th>
                  {puedeEditar && <th scope="col" className={celda}><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {control.data.meses.map((m) => {
                  const nombre = formatearPeriodo(anio, m.mes)
                  const filas = m.reportes.length > 0 ? m.reportes : [null]
                  return (
                    <Fragment key={m.mes}>
                      {filas.map((r, i) => (
                        <tr key={r?.id ?? 'sin-reporte'} className={cn('border-t', r?.hayDiferencia && 'bg-warning/10')}>
                          {i === 0 && (
                            <th scope="row" rowSpan={filas.length} className={cn(celda, 'text-left font-medium')}>{nombreMes(m.mes)}</th>
                          )}
                          <td className={cn(celda, 'text-right')}>
                            {r?.toneladasReportadas ? <Cifra tipo="toneladas" valor={r.toneladasReportadas} /> : <span className="text-muted-foreground">Sin reporte</span>}
                          </td>
                          <td className={celda}>{r?.fuente ?? '—'}</td>
                          {i === 0 && (
                            <td rowSpan={filas.length} className={cn(celda, 'text-right')}><Cifra tipo="toneladas" valor={m.comprasKardex} /></td>
                          )}
                          <td className={cn(celda, 'text-right')}>{r ? <Diferencia reporte={r} /> : <span className="text-muted-foreground">—</span>}</td>
                          <td className={cn(celda, 'max-w-72')}>
                            {r?.observacion && <span className="block">{r.observacion}</span>}
                            {r?.nota && <span className="block text-xs text-muted-foreground">Nota: {r.nota}</span>}
                            {!r?.observacion && !r?.nota && <span className="text-muted-foreground">—</span>}
                          </td>
                          {puedeEditar && (
                            <td className={celda}>
                              {r ? (
                                <Button type="button" variant="ghost" size="sm" aria-label={`Editar el tonelaje de ${nombre} (${r.fuente})`}
                                  onClick={(e) => dialogo.abrir({ mes: m, reporte: r }, e.currentTarget)}>
                                  <PencilIcon aria-hidden="true" />
                                  Editar
                                </Button>
                              ) : (
                                <Button type="button" variant="ghost" size="sm" aria-label={`Registrar el tonelaje de ${nombre}`}
                                  onClick={(e) => dialogo.abrir({ mes: m }, e.currentTarget)}>
                                  <PlusIcon aria-hidden="true" />
                                  Registrar
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {puedeEditar && dialogo.datos && (
        <DialogoTonelaje key={dialogo.apertura} anio={anio} mes={dialogo.datos.mes.mes} comprasKardex={dialogo.datos.mes.comprasKardex}
          reporte={dialogo.datos.reporte} abierto={dialogo.abierto} alCambiarAbierto={dialogo.cambiarAbierto} focoAlCerrar={dialogo.disparador} />
      )}
    </div>
  )
}
