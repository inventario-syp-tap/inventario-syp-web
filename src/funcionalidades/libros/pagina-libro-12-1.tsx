// Libro 12.1 — unidades físicas (docs/UI-UX.md §5.11). Todos ven. Filtros en la URL (año, mes o año completo,
// producto o todos) y el modo del año (AGRUPADO o DETALLADO). Vista previa que imita la hoja A4 horizontal con el
// JSON de la API, Descargar PDF (todos), Página de prueba de márgenes (A, C) y Registrar impresión (A, C; solo meses
// cerrados). Estado del mes: Pendiente / ✓ Impreso / ⚠ Impresión desactualizada: vuelve a imprimir.
import { Link } from 'react-router'
import { FileCheckIcon, PrinterIcon, RulerIcon } from 'lucide-react'
import { FiltrosLibro } from './filtros-libro'
import { useFiltrosLibro } from './use-filtros-libro'
import { DialogoRegistrarImpresion } from './dialogo-registrar-impresion'
import { VistaPrevia121 } from './vista-previa-12-1'
import { RUTA_PRUEBA_MARGENES, rutaPdfLibro121, useImpresiones121, useLibro121, type ImpresionLibro121 } from '@/api/libros'
import { usePeriodos } from '@/api/periodos'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Aviso } from '@/componentes/comunes/aviso'
import { BotonDescarga } from '@/componentes/comunes/boton-descarga'
import { ChipEstadoPeriodo } from '@/componentes/comunes/chip-estado-periodo'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { EstadoLibro121 } from '@/componentes/comunes/estado-libro-121'
import { Button } from '@/componentes/ui/button'
import { Skeleton } from '@/componentes/ui/skeleton'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearFechaHora, formatearPeriodo } from '@/lib/formato'
import { usePuede } from '@/lib/roles'

function nombreArchivo(anio: number, mes: number | null) {
  return `libro-12-1-${anio}${mes ? `-${String(mes).padStart(2, '0')}` : ''}.pdf`
}

function Impresiones({ impresiones }: { impresiones: readonly ImpresionLibro121[] }) {
  if (impresiones.length === 0) return null
  return (
    <div className="flex flex-col gap-1 text-sm">
      <h2 className="font-medium">Impresiones registradas</h2>
      <ul className="flex flex-col gap-1 text-muted-foreground">
        {impresiones.map((i) => (
          <li key={i.id}>
            <span className="text-foreground">{formatearFechaHora(i.impresoEn)}</span>
            {i.impresoPor ? ` · ${i.impresoPor}` : ''}
            {i.reimpresion ? ' · reimpresión' : ''}
            {i.vigente ? ' · vigente' : ' · ya no coincide con los datos actuales'}
            {i.observacion ? ` · ${i.observacion}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PaginaLibro121() {
  useTituloPagina('Libro 12.1')
  const { filtros, paraApi, cambiar } = useFiltrosLibro()
  const libro = useLibro121(paraApi)
  const periodos = usePeriodos(filtros.anio)
  const impresiones = useImpresiones121(filtros.anio)
  const puedeRegistrar = usePuede('libros:registrar-impresion')
  const puedeProbarMargenes = usePuede('libros:prueba-margenes')
  const dialogo = useDialogo()

  const mes = filtros.mes
  const periodo = mes === null ? undefined : periodos.data?.meses.find((m) => m.mes === mes)
  const estadoLibro = mes === null ? undefined : impresiones.data?.meses.find((m) => m.mes === mes) ?? periodo?.libro121
  const impresionesDelMes = mes === null ? [] : (impresiones.data?.impresiones ?? []).filter((i) => i.mes === mes)
  const mesCerrado = periodo?.estado === 'CERRADO'
  const textoPeriodo = mes === null ? `todo ${filtros.anio}` : formatearPeriodo(filtros.anio, mes)

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Libro 12.1"
        descripcion="Registro del inventario permanente en unidades físicas. Se imprime en las hojas legalizadas con el PDF del sistema."
        acciones={(
          <>
            <BotonDescarga ruta={rutaPdfLibro121(paraApi)} nombrePorDefecto={nombreArchivo(filtros.anio, mes)} variante="default"
              icono={<PrinterIcon aria-hidden="true" />} aria-label={`Descargar PDF del libro 12.1 de ${textoPeriodo}`}>
              Descargar PDF
            </BotonDescarga>
            {puedeProbarMargenes && (
              <BotonDescarga ruta={RUTA_PRUEBA_MARGENES} nombrePorDefecto="prueba-margenes-12-1.pdf" icono={<RulerIcon aria-hidden="true" />}>
                Página de prueba de márgenes
              </BotonDescarga>
            )}
            {puedeRegistrar && mes !== null && mesCerrado && (
              <Button type="button" variant="outline" onClick={(e) => dialogo.abrir(undefined, e.currentTarget)}>
                <FileCheckIcon aria-hidden="true" />
                Registrar impresión
              </Button>
            )}
          </>
        )}
      />

      <FiltrosLibro filtros={filtros} cambiar={cambiar} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <p>
          Modo del año:{' '}
          {libro.data ? <span className="font-medium">{libro.data.modo}</span> : <span className="text-muted-foreground">…</span>}
          {puedeRegistrar && (
            <> (<Link className="underline underline-offset-2" to={`${RAIZ_MODULO}/configuracion`}>Configuración</Link>)</>
          )}
        </p>
        {mes !== null && periodo && (
          <p className="inline-flex items-center gap-2">Mes: <ChipEstadoPeriodo estado={periodo.estado} /></p>
        )}
        {mes !== null && estadoLibro && (
          <p className="inline-flex flex-wrap items-center gap-1">
            Estado: <EstadoLibro121 estado={estadoLibro.estado} impresoEn={estadoLibro.impresoEn} className="font-medium" />
          </p>
        )}
      </div>

      {mes === null ? (
        <p className="text-sm text-muted-foreground">Elige un mes para ver su estado de impresión y registrarla.</p>
      ) : periodo && !mesCerrado ? (
        <Aviso tono="info" titulo={`${formatearPeriodo(filtros.anio, mes)} está ${periodo.estado === 'ABIERTO' ? 'abierto' : 'sin periodo'}`}>
          El libro 12.1 se imprime en las hojas legalizadas después de cerrar el mes en{' '}
          <Link className="text-foreground underline underline-offset-2" to={`${RAIZ_MODULO}/periodos?anio=${filtros.anio}`}>Periodos</Link>.
          Mientras tanto puedes revisar la vista previa.
        </Aviso>
      ) : estadoLibro?.estado === 'DESACTUALIZADO' ? (
        <Aviso tono="advertencia" titulo="Impresión desactualizada: vuelve a imprimir">
          Los datos del mes cambiaron después de la última impresión registrada.
        </Aviso>
      ) : null}

      {mes !== null && (periodos.isError || impresiones.isError) && (
        <Aviso tono="error" titulo="No pudimos leer el estado del mes"
          acciones={(
            <Button type="button" size="sm" variant="outline" onClick={() => {
              if (periodos.isError) void periodos.refetch()
              if (impresiones.isError) void impresiones.refetch()
            }}>
              Reintentar
            </Button>
          )}>
          {mensajeDeError(periodos.error ?? impresiones.error)} Sin ese dato no se puede registrar la impresión.
        </Aviso>
      )}

      {mes !== null && <Impresiones impresiones={impresionesDelMes} />}

      {libro.isError ? (
        <EstadoError mensaje={mensajeDeError(libro.error)} alReintentar={() => void libro.refetch()} />
      ) : !libro.data ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Cargando el libro 12.1…</span>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : libro.data.bloques.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          No hay datos del libro 12.1 para {textoPeriodo}.
        </p>
      ) : (
        <VistaPrevia121 bloques={libro.data.bloques} />
      )}

      {mes !== null && dialogo.apertura > 0 && (
        <DialogoRegistrarImpresion key={dialogo.apertura} anio={filtros.anio} mes={mes}
          reimpresion={impresionesDelMes.length > 0}
          abierto={dialogo.abierto} alCambiarAbierto={dialogo.cambiarAbierto} focoAlCerrar={dialogo.disparador} />
      )}
    </div>
  )
}
