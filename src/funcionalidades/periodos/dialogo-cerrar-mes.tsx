// Cerrar un mes (docs/UI-UX.md §5.9). Antes de confirmar lista los saldos negativos del mes según
// GET /kardex/alertas (advertencia: no impiden el cierre). Si la API rechaza con CIERRE_CON_SALDO_CERO_CON_COSTO,
// el diálogo sigue abierto y lista esos movimientos con enlace al kardex. Un conflicto se resuelve recargando.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RefObject } from 'react'
import { ListaMovimientos } from './lista-movimientos'
import { leerMovimientosSaldoCero, saldoCeroDesdeAlertas } from './saldo-cero'
import { invalidarTrasEscritura } from '@/api/claves'
import type { Alerta } from '@/api/kardex'
import { anioMesDeFecha, cerrarPeriodo, type ResultadoCierre } from '@/api/periodos'
import { Aviso } from '@/componentes/comunes/aviso'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Button } from '@/componentes/ui/button'
import { Spinner } from '@/componentes/ui/spinner'
import { codigoDeError, ErrorApi, esConflicto, mensajeDeError } from '@/lib/errores'
import { formatearPeriodo } from '@/lib/formato'

type Props = {
  anio: number
  mes: number
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  /** Alertas del año (GET /kardex/alertas): se filtran las del mes. */
  alertas: readonly Alerta[]
  focoAlCerrar?: RefObject<HTMLElement | null>
  alCerrar: (resultado: ResultadoCierre) => void
  /** Tras cerrar bien, el botón «Cerrar mes» desaparece: a dónde va el foco (aviso de resultado o título). */
  enfocarTrasCerrar?: () => void
}

/** El mensaje de la API con el mes del diálogo si su detalle no lo trae. */
const conPeriodo = (error: unknown, anio: number, mes: number) =>
  error instanceof ErrorApi ? new ErrorApi(error.status, error.codigo, error.message, { anio, mes, ...error.detalle }, error.requestId) : error

export function DialogoCerrarMes({ anio, mes, abierto, alCambiarAbierto, alertas, focoAlCerrar, alCerrar, enfocarTrasCerrar }: Props) {
  const clienteConsultas = useQueryClient()
  const nombre = formatearPeriodo(anio, mes)
  const cerrar = useMutation({
    mutationFn: () => cerrarPeriodo(anio, mes),
    onSuccess: (resultado) => {
      invalidarTrasEscritura(clienteConsultas)
      alCambiarAbierto(false)
      alCerrar(resultado)
    },
  })

  const negativos = alertas
    .filter((a) => a.tipo === 'STOCK_NEGATIVO' && a.anio === anio && (anioMesDeFecha(a.fecha)?.mes ?? a.mes) === mes)
    .map((a) => ({ movimientoId: a.movimientoId, productoId: a.productoId, productoCodigo: a.productoCodigo, fecha: a.fecha, documento: a.documento }))

  const error = cerrar.error
  const codigo = codigoDeError(error)
  const saldoCero = codigo === 'CIERRE_CON_SALDO_CERO_CON_COSTO'
  const movimientosSaldoCero = saldoCero
    ? (() => {
        const delDetalle = leerMovimientosSaldoCero(error)
        return delDetalle.length > 0 ? delDetalle : saldoCeroDesdeAlertas(alertas, anio, mes)
      })()
    : []

  const cambiarAbierto = (siguiente: boolean) => {
    if (cerrar.isPending) return
    if (!siguiente) cerrar.reset()
    alCambiarAbierto(siguiente)
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      <AlertDialogContent
        className="max-h-[90svh] overflow-y-auto"
        onCloseAutoFocus={(evento) => {
          if (cerrar.isSuccess && enfocarTrasCerrar) {
            evento.preventDefault()
            enfocarTrasCerrar()
            return
          }
          if (!focoAlCerrar?.current) return
          evento.preventDefault()
          focoAlCerrar.current.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Cerrar {nombre}</AlertDialogTitle>
          <AlertDialogDescription>
            Al cerrar {nombre} ya no se podrá registrar, editar, anular ni reordenar movimientos de ese mes. El sistema
            guarda los totales del mes; para corregir algo después habrá que reabrirlo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {negativos.length > 0 && (
          <Aviso tono="advertencia" titulo={`${negativos.length === 1 ? 'Hay 1 saldo negativo' : `Hay ${negativos.length} saldos negativos`} en el mes (no impiden el cierre)`}>
            <ListaMovimientos movimientos={negativos} alerta="STOCK_NEGATIVO" anio={anio} mes={mes} alNavegar={() => cambiarAbierto(false)} />
          </Aviso>
        )}

        {error && esConflicto(error) ? (
          <AvisoConflicto alReintentar={() => {
            cerrar.reset()
            invalidarTrasEscritura(clienteConsultas)
          }} />
        ) : error ? (
          <Aviso tono="error" titulo={mensajeDeError(conPeriodo(error, anio, mes))}>
            {saldoCero && (
              <ListaMovimientos movimientos={movimientosSaldoCero} alerta="SALDO_CERO_CON_COSTO" anio={anio} mes={mes}
                alNavegar={() => cambiarAbierto(false)} />
            )}
          </Aviso>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={cerrar.isPending}>Cancelar</AlertDialogCancel>
          <Button type="button" disabled={cerrar.isPending} onClick={() => cerrar.mutate()}>
            {cerrar.isPending && <Spinner aria-hidden="true" />}
            {cerrar.isPending ? 'Cerrando…' : `Cerrar ${nombre}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
