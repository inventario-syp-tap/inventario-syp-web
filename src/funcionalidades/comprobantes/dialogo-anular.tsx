// Anular un comprobante (docs/UI-UX.md §5.7): confirmación con motivo obligatorio que repite el efecto. Anular
// una entrada puede dejar negativo el stock → DialogoStockNegativo y reenvío con la confirmación. Un 409
// ORDEN_EN_CONFLICTO deja un aviso persistente con "Reintentar"; los demás errores, un aviso persistente.
import { useEffect, type RefObject } from 'react'
import { toast } from 'sonner'
import { documentoComprobante, nombreOperacion, participio } from './esquemas'
import { useEscritura } from './use-escritura'
import { anularComprobante, type Comprobante, type DatosAnular } from '@/api/comprobantes'
import { textoProducto, useProductos } from '@/api/productos'
import { DialogoConfirmacion } from '@/componentes/comunes/dialogo-confirmacion'
import { DialogoStockNegativo } from '@/componentes/comunes/dialogo-stock-negativo'
import { mensajeDeError } from '@/lib/errores'

type Props = {
  comprobante: Comprobante | undefined
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
  alAnular?: (anulado: Comprobante) => void
}

const productosDe = (c: Comprobante) => [...new Set(c.lineas.map((l) => l.productoCodigo))].join(', ')

export function DialogoAnular({ comprobante, abierto, alCambiarAbierto, focoAlCerrar, alAnular }: Props) {
  const productos = useProductos()
  const id = comprobante?.id ?? ''
  const escritura = useEscritura<DatosAnular>({
    ejecutar: (cuerpo) => anularComprobante(id, cuerpo),
    alExito: (resultado) => {
      toast.success(`${nombreOperacion(resultado.comprobante)} ${documentoComprobante(resultado.comprobante)} ${participio(resultado.comprobante, 'anulad')} · kardex recalculado`)
      alAnular?.(resultado.comprobante)
    },
    alError: (error) => toast.error(mensajeDeError(error), { duration: Infinity }),
  })

  const { hayConflicto, reintentar, descartarConflicto } = escritura
  useEffect(() => {
    if (!hayConflicto) return
    toast.error('Otro usuario modificó este kardex al mismo tiempo; vuelve a intentarlo.', {
      id: `conflicto-${id}`,
      duration: Infinity,
      action: { label: 'Reintentar', onClick: reintentar },
      onDismiss: descartarConflicto,
    })
  }, [hayConflicto, id, reintentar, descartarConflicto])

  const detalle = escritura.confirmacion
  const producto = detalle?.productoId ? productos.data?.find((p) => p.id === detalle.productoId) : undefined

  return (
    <>
      {comprobante && (
        <DialogoConfirmacion
          abierto={abierto}
          alCambiarAbierto={alCambiarAbierto}
          titulo={`Anular ${documentoComprobante(comprobante)}`}
          descripcion={`Se anulará ${nombreOperacion(comprobante).toLowerCase()} ${documentoComprobante(comprobante)} y se recalculará el kardex de ${productosDe(comprobante)} ${comprobante.fecha.slice(0, 4)}. El número queda libre para registrarlo de nuevo.`}
          textoConfirmar="Anular"
          motivo="obligatorio"
          destructiva
          focoAlCerrar={focoAlCerrar}
          alConfirmar={(motivo) => escritura.enviar({ motivo })}
        />
      )}
      <DialogoStockNegativo
        abierto={detalle !== null}
        alCambiarAbierto={(siguiente) => { if (!siguiente) escritura.cancelarConfirmacion() }}
        detalle={detalle}
        producto={producto ? textoProducto(producto) : null}
        alConfirmar={escritura.confirmar}
        focoAlCerrar={focoAlCerrar}
      />
    </>
  )
}
