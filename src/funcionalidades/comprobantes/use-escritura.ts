// Una escritura de comprobante (registrar, editar o anular) con los dos 409 que no son errores del formulario:
//  - STOCK_NEGATIVO_REQUIERE_CONFIRMACION → guarda el cuerpo y espera la decisión; `confirmar()` reenvía la MISMA
//    petición con `confirmarStockNegativo: true` (docs/CONTRATO-API.md §5).
//  - ORDEN_EN_CONFLICTO → guarda el cuerpo; `reintentar()` lo reenvía igual (la API revirtió la transacción).
// Nunca se reintenta solo. Al terminar bien se invalidan kardex, stock, dashboard, periodos y comprobantes.
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidarTrasEscritura, type CuerpoConConfirmacion, type ResultadoEscritura } from '@/api/comprobantes'
import { leerDetalleStockNegativo, type DetalleStockNegativo } from '@/lib/stock-negativo'
import { codigoDeError, ErrorApi } from '@/lib/errores'

type Opciones<C extends CuerpoConConfirmacion> = {
  ejecutar: (cuerpo: C) => Promise<ResultadoEscritura>
  alExito: (resultado: ResultadoEscritura, cuerpo: C) => void
  /** Cualquier otro error (se ubica en el formulario o se avisa). */
  alError: (error: unknown, cuerpo: C) => void
}

export function useEscritura<C extends CuerpoConConfirmacion>({ ejecutar, alExito, alError }: Opciones<C>) {
  const clienteConsultas = useQueryClient()
  const [confirmacion, setConfirmacion] = useState<{ detalle: DetalleStockNegativo; cuerpo: C } | null>(null)
  const [conflicto, setConflicto] = useState<C | null>(null)

  const mutacion = useMutation({
    mutationFn: ejecutar,
    onSuccess: (resultado, cuerpo) => {
      invalidarTrasEscritura(clienteConsultas)
      setConflicto(null)
      alExito(resultado, cuerpo)
    },
    onError: (error, cuerpo) => {
      const codigo = codigoDeError(error)
      if (codigo === 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION' && !cuerpo.confirmarStockNegativo) {
        setConfirmacion({ detalle: leerDetalleStockNegativo(error instanceof ErrorApi ? error.detalle : undefined), cuerpo })
        return
      }
      if (codigo === 'ORDEN_EN_CONFLICTO') {
        setConflicto(cuerpo)
        return
      }
      setConflicto(null)
      alError(error, cuerpo)
    },
  })

  return {
    enviando: mutacion.isPending,
    enviar: (cuerpo: C) => {
      setConflicto(null)
      mutacion.mutate(cuerpo)
    },
    /** Detalle del 409 de stock negativo mientras se espera la decisión. */
    confirmacion: confirmacion?.detalle ?? null,
    confirmar: () => {
      if (!confirmacion) return
      setConfirmacion(null)
      mutacion.mutate({ ...confirmacion.cuerpo, confirmarStockNegativo: true })
    },
    cancelarConfirmacion: () => setConfirmacion(null),
    /** Hubo un 409 ORDEN_EN_CONFLICTO: mostrar "Reintentar". */
    hayConflicto: conflicto !== null,
    reintentar: () => {
      if (conflicto) mutacion.mutate(conflicto)
    },
    descartarConflicto: () => setConflicto(null),
  }
}
