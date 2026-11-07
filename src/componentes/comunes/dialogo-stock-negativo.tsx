// 409 STOCK_NEGATIVO_REQUIERE_CONFIRMACION (docs/UI-UX.md §4 y §6, docs/CONTRATO-API.md §5): muestra producto,
// fecha, disponible antes y saldo resultante. "Registrar de todos modos" reenvía la MISMA petición con
// `confirmarStockNegativo: true` (lo hace quien lo usa en `alConfirmar`). Cancelar no envía nada.
import type { RefObject } from 'react'
import { OctagonXIcon } from 'lucide-react'
import { Cifra } from './cifra'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { formatearFecha, formatearToneladas } from '@/lib/formato'
import type { DetalleStockNegativo } from '@/lib/stock-negativo'

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  detalle: DetalleStockNegativo | null
  /** Nombre del producto (código · descripción); si no se conoce, se usa el id. */
  producto: string | null
  alConfirmar: () => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoStockNegativo({ abierto, alCambiarAbierto, detalle, producto, alConfirmar, focoAlCerrar }: Props) {
  const nombre = producto ?? (detalle?.productoId ? `el producto ${detalle.productoId}` : 'el producto')
  const fecha = formatearFecha(detalle?.fecha)
  return (
    <AlertDialog open={abierto} onOpenChange={alCambiarAbierto}>
      <AlertDialogContent
        onCloseAutoFocus={(evento) => {
          if (!focoAlCerrar?.current) return
          evento.preventDefault()
          focoAlCerrar.current.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <OctagonXIcon aria-hidden="true" className="size-5 text-destructive" />
            El stock quedará en negativo
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta salida deja {nombre} en {formatearToneladas(detalle?.saldoResultante)} TN al {fecha}. ¿Registrar de todos modos?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
          <dt className="text-muted-foreground">Producto</dt>
          <dd>{nombre}</dd>
          <dt className="text-muted-foreground">Fecha</dt>
          <dd className="tabular-nums">{fecha}</dd>
          <dt className="text-muted-foreground">Disponible antes</dt>
          <dd><Cifra tipo="toneladas" valor={detalle?.disponibleAntes} /> TN</dd>
          <dt className="text-muted-foreground">Saldo resultante</dt>
          <dd><Cifra tipo="toneladas" valor={detalle?.saldoResultante} /> TN</dd>
        </dl>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={alConfirmar}>Registrar de todos modos</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
