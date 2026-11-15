// Kardex (docs/UI-UX.md §5.8), la pantalla más importante. Filtros en la URL (producto, año, mes o "Todo el año",
// Detallado); la tabla muestra los valores de GET /kardex tal cual, formateados. Clic en una fila → panel lateral con
// el comprobante. Reordenar ↑/↓ (A, C) solo dentro de la misma fecha, con confirmación. Recalcular (solo A).
// Exportar a Excel y el PDF del 13.1 llegan en el Sprint 10.
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCwIcon } from 'lucide-react'
import { documentoFila, escribirFiltrosKardex, leerFiltrosKardex, type FiltrosKardexUrl } from './filtros-url'
import { ResumenAlertas } from './resumen-alertas'
import { TablaKardex, type Direccion } from './tabla-kardex'
import { invalidarTrasEscritura } from '@/api/claves'
import { useComprobante, type ResultadoEscritura } from '@/api/comprobantes'
import {
  moverMovimiento, recalcularKardex, useAlertasKardex, useKardex, type DatosMover, type FilaKardex,
} from '@/api/kardex'
import { textoProducto, useProductos } from '@/api/productos'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { DialogoConfirmacion } from '@/componentes/comunes/dialogo-confirmacion'
import { DialogoStockNegativo } from '@/componentes/comunes/dialogo-stock-negativo'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { Button } from '@/componentes/ui/button'
import { Label } from '@/componentes/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/componentes/ui/sheet'
import { Skeleton } from '@/componentes/ui/skeleton'
import { DetalleComprobante } from '@/funcionalidades/comprobantes/detalle-comprobante'
import { useEscritura } from '@/funcionalidades/comprobantes/use-escritura'
import { useDialogo } from '@/hooks/use-dialogo'
import { esConflicto, mensajeDeError } from '@/lib/errores'
import { formatearEntero, formatearFecha, formatearPeriodo } from '@/lib/formato'
import { usePuede } from '@/lib/roles'

type CuerpoMover = DatosMover & { movimientoId: string }
type Movimiento = { fila: FilaKardex; direccion: Direccion }

export function PaginaKardex() {
  useTituloPagina('Kardex')
  const id = useId()
  const [parametros, setParametros] = useSearchParams()
  const { hash } = useLocation()
  const clienteConsultas = useQueryClient()
  const productos = useProductos()
  const puedeReordenar = usePuede('kardex:reordenar')
  const puedeRecalcular = usePuede('kardex:recalcular')

  const filtros = leerFiltrosKardex(parametros)
  const productoId = filtros.productoId ?? productos.data?.find((p) => p.activo)?.id ?? productos.data?.[0]?.id ?? null
  const producto = productos.data?.find((p) => p.id === productoId)
  const kardex = useKardex(productoId === null ? null : { productoId, anio: filtros.anio, mes: filtros.mes ?? undefined })
  const alertas = useAlertasKardex(filtros.anio)

  const cambiarFiltros = (cambios: Partial<FiltrosKardexUrl>) =>
    setParametros(escribirFiltrosKardex({ ...filtros, productoId, ...cambios }), { replace: true })

  // Panel lateral con el comprobante de la fila.
  const panel = useDialogo<FilaKardex>()
  const comprobante = useComprobante(panel.abierto ? panel.datos?.comprobanteId : undefined)

  // Enlace de una alerta (#fila-<id>): desplaza hasta la fila, la resalta y le da el foco.
  const filaResaltada = hash.startsWith('#fila-') ? hash.slice('#fila-'.length) : null
  const datosListos = !!kardex.data
  useEffect(() => {
    if (!filaResaltada || !datosListos) return
    const fila = document.getElementById(`fila-${filaResaltada}`)
    fila?.scrollIntoView({ block: 'center' })
    fila?.focus()
  }, [filaResaltada, datosListos])

  // Reordenar: confirmación que explica el efecto; luego POST /movimientos/:id/mover.
  const [movimiento, setMovimiento] = useState<Movimiento | null>(null)
  const origenMover = useRef<HTMLElement | null>(null)
  const avisoConflicto = useRef<HTMLDivElement>(null)
  const mover = useEscritura<CuerpoMover, ResultadoEscritura>({
    ejecutar: ({ movimientoId, ...cuerpo }) => moverMovimiento(movimientoId, cuerpo),
    alExito: () => toast.success('Orden cambiado · kardex recalculado'),
    alError: (error) => toast.error(mensajeDeError(error), { duration: Infinity }),
  })
  const { hayConflicto: conflictoMover } = mover

  // Recalcular (solo ADMIN): el producto y el año elegidos.
  const [confirmarRecalculo, setConfirmarRecalculo] = useState(false)
  const botonRecalcular = useRef<HTMLButtonElement>(null)
  const [conflictoRecalculo, setConflictoRecalculo] = useState(false)
  const recalcular = useMutation({
    mutationFn: recalcularKardex,
    onSuccess: (resultado) => {
      invalidarTrasEscritura(clienteConsultas)
      setConflictoRecalculo(false)
      const desactualizados = resultado.saldosDesactualizados.length
      toast.success(`Kardex recalculado: ${formatearEntero(resultado.filas)} filas, ${formatearEntero(resultado.filasCambiadas)} con cambios.`, {
        description: desactualizados > 0
          ? `Saldos iniciales de ${resultado.anio + 1} marcados como desactualizados: ${resultado.saldosDesactualizados.join(', ')}. Revisa el cierre anual.`
          : undefined,
      })
    },
    onError: (error) => {
      if (esConflicto(error)) {
        setConflictoRecalculo(true)
        return
      }
      toast.error(mensajeDeError(error), { duration: Infinity })
    },
  })

  const hayConflicto = conflictoMover || conflictoRecalculo
  useEffect(() => {
    if (hayConflicto) avisoConflicto.current?.focus()
  }, [hayConflicto])

  const recargarTrasConflicto = () => {
    setConflictoRecalculo(false)
    mover.recargar()
  }

  const periodoTexto = filtros.mes === null ? `todo ${filtros.anio}` : formatearPeriodo(filtros.anio, filtros.mes)
  const nombreProducto = producto ? textoProducto(producto) : 'el producto'
  const sinProductos = productos.isSuccess && productos.data.length === 0
  const sinMovimientos = !!kardex.data && kardex.data.meses.every((m) => m.filas.length === 0)

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Kardex"
        descripcion="Valorizado al costo promedio ponderado. Los valores los calcula el sistema."
        acciones={puedeRecalcular && producto && (
          <Button ref={botonRecalcular} type="button" variant="outline" disabled={recalcular.isPending}
            onClick={() => setConfirmarRecalculo(true)}>
            <RefreshCwIcon aria-hidden="true" className={recalcular.isPending ? 'animate-spin' : undefined} />
            {recalcular.isPending ? 'Recalculando…' : 'Recalcular'}
          </Button>
        )}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-producto`}>Producto</Label>
          <CampoSelect id={`${id}-producto`} className="w-72" value={productoId === null ? '' : String(productoId)}
            disabled={!productos.data}
            vacio={productos.isPending ? 'Cargando productos…' : undefined}
            opciones={(productos.data ?? []).map((p) => ({ valor: String(p.id), texto: `${textoProducto(p)}${p.activo ? '' : ' (inactivo)'}` }))}
            onChange={(evento) => cambiarFiltros({ productoId: Number.parseInt(evento.target.value, 10) })} />
        </div>
        <SelectorPeriodo anio={filtros.anio} mes={filtros.mes} permitirTodoElAnio
          alCambiarAnio={(anio) => cambiarFiltros({ anio })}
          alCambiarMes={(mes) => cambiarFiltros({ mes })} />
        <div className="pb-2">
          <CampoCasilla id={`${id}-detallado`} etiqueta="Detallado" marcado={filtros.detallado}
            alCambiar={(detallado) => cambiarFiltros({ detallado })} />
        </div>
      </div>

      {hayConflicto && <AvisoConflicto ref={avisoConflicto} alReintentar={recargarTrasConflicto} />}
      {alertas.data && <ResumenAlertas alertas={alertas.data} />}

      {sinProductos ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Aún no hay productos. <Link className="text-foreground underline underline-offset-2" to={`${RAIZ_MODULO}/maestros/productos`}>Ir a Productos</Link>
        </p>
      ) : productos.isError ? (
        <EstadoError mensaje={mensajeDeError(productos.error)} alReintentar={() => void productos.refetch()} />
      ) : kardex.isError ? (
        <EstadoError mensaje={mensajeDeError(kardex.error)} alReintentar={() => void kardex.refetch()} />
      ) : !kardex.data ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Cargando el kardex…</span>
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : (
        <>
          <TablaKardex
            kardex={kardex.data}
            detallado={filtros.detallado}
            puedeReordenar={puedeReordenar}
            filaResaltada={filaResaltada}
            // Clic en la fila (sin botón de origen): el foco vuelve al botón del comprobante de esa fila.
            alVer={(fila, origen) => panel.abrir(fila, origen
              ?? document.getElementById(`fila-${fila.movimientoId}`)?.querySelector<HTMLElement>('button[aria-label^="Ver "]'))}
            alMover={(fila, direccion, origen) => {
              origenMover.current = origen
              setMovimiento({ fila, direccion })
            }}
          />
          {sinMovimientos && (
            <p className="text-sm text-muted-foreground">
              Sin movimientos de {kardex.data.producto.codigo} en {periodoTexto}.{' '}
              <Link className="text-foreground underline underline-offset-2" to={`${RAIZ_MODULO}/comprobantes`}>Ver comprobantes</Link>
            </p>
          )}
        </>
      )}

      <Sheet open={panel.abierto} onOpenChange={panel.cambiarAbierto}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl data-[side=right]:lg:max-w-5xl"
          onCloseAutoFocus={(evento) => {
            if (!panel.disparador.current) return
            evento.preventDefault()
            panel.disparador.current.focus()
          }}
        >
          {panel.datos && (
            <>
              <SheetHeader>
                <SheetTitle>{documentoFila(panel.datos)} · {formatearFecha(panel.datos.fecha)}</SheetTitle>
                <SheetDescription>
                  <Link className="underline underline-offset-2" to={`${RAIZ_MODULO}/comprobantes/${encodeURIComponent(panel.datos.comprobanteId)}`}>
                    Abrir el comprobante
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                {comprobante.isError ? (
                  <EstadoError mensaje={mensajeDeError(comprobante.error)} alReintentar={() => void comprobante.refetch()} />
                ) : comprobante.data ? (
                  <DetalleComprobante comprobante={comprobante.data} />
                ) : (
                  <div role="status" className="flex flex-col gap-2">
                    <span className="sr-only">Cargando el comprobante…</span>
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <DialogoConfirmacion
        abierto={movimiento !== null}
        alCambiarAbierto={(abierto) => { if (!abierto) setMovimiento(null) }}
        titulo={movimiento ? `${movimiento.direccion === 'ARRIBA' ? 'Subir' : 'Bajar'} ${documentoFila(movimiento.fila)}` : 'Reordenar'}
        descripcion={movimiento && (
          <>
            Se moverá {documentoFila(movimiento.fila)} un lugar {movimiento.direccion === 'ARRIBA' ? 'arriba' : 'abajo'} entre los
            movimientos del {formatearFecha(movimiento.fila.fecha)}. El orden de un mismo día cambia el costo de las salidas
            de ese día: el sistema recalculará el kardex de {nombreProducto} {filtros.anio}.
          </>
        )}
        textoConfirmar="Mover"
        focoAlCerrar={origenMover}
        alConfirmar={() => {
          if (movimiento) mover.enviar({ movimientoId: movimiento.fila.movimientoId, direccion: movimiento.direccion })
          setMovimiento(null)
        }}
      />
      <DialogoStockNegativo
        abierto={mover.confirmacion !== null}
        alCambiarAbierto={(abierto) => { if (!abierto) mover.cancelarConfirmacion() }}
        detalle={mover.confirmacion}
        producto={producto ? textoProducto(producto) : null}
        alConfirmar={mover.confirmar}
        focoAlCerrar={origenMover}
      />
      <DialogoConfirmacion
        abierto={confirmarRecalculo}
        alCambiarAbierto={setConfirmarRecalculo}
        titulo="Recalcular el kardex"
        descripcion={`Se recalculará el kardex de ${nombreProducto} ${filtros.anio} con los movimientos registrados. No cambia ningún comprobante; si el saldo final cambia, el saldo inicial de ${filtros.anio + 1} quedará marcado como desactualizado.`}
        textoConfirmar="Recalcular"
        focoAlCerrar={botonRecalcular}
        alConfirmar={() => {
          if (productoId !== null) recalcular.mutate({ anio: filtros.anio, productoId })
        }}
      />
    </div>
  )
}
