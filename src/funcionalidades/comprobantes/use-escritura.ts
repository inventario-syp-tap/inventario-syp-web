// Una escritura que cambia el kardex (registrar, editar, anular, mover) con los dos 409 que no son errores del
// formulario:
//  - STOCK_NEGATIVO_REQUIERE_CONFIRMACION → guarda el cuerpo y espera la decisión; `confirmar()` reenvía la MISMA
//    petición con `confirmarStockNegativo: true` (docs/CONTRATO-API.md §5).
//  - ORDEN_EN_CONFLICTO o CONFLICTO_CONCURRENTE → otro usuario cambió los mismos datos y la API no guardó nada.
//    `recargar()` vuelve a cargar los datos (invalida las consultas) SIN reenviar: la persona revisa y vuelve a guardar.
// Nunca se reintenta solo. Al terminar bien se invalidan kardex, alertas, stock, dashboard, periodos, saldos
// iniciales y comprobantes.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidarTrasEscritura } from '@/api/claves'
import type { CuerpoConConfirmacion, ResultadoEscritura } from '@/api/comprobantes'
import { leerDetalleStockNegativo, type DetalleStockNegativo } from '@/lib/stock-negativo'
import { codigoDeError, ErrorApi, esConflicto } from '@/lib/errores'

type Opciones<C extends CuerpoConConfirmacion, R> = {
  ejecutar: (cuerpo: C) => Promise<R>
  alExito: (resultado: R, cuerpo: C) => void
  /** Cualquier otro error (se ubica en el formulario o se avisa). */
  alError: (error: unknown, cuerpo: C) => void
  /** Además de invalidar las consultas, al pulsar "Reintentar" tras un conflicto (p. ej. reiniciar el formulario). */
  alRecargar?: () => void
}

export function useEscritura<C extends CuerpoConConfirmacion, R = ResultadoEscritura>({ ejecutar, alExito, alError, alRecargar }: Opciones<C, R>) {
  const clienteConsultas = useQueryClient()
  const [confirmacion, setConfirmacion] = useState<{ detalle: DetalleStockNegativo; cuerpo: C } | null>(null)
  const [conflicto, setConflicto] = useState(false)
  const alRecargarActual = useRef(alRecargar)
  useEffect(() => {
    alRecargarActual.current = alRecargar
  })
  // Estables entre renders: se usan como dependencias de efectos (toast persistente del conflicto).
  const recargar = useCallback(() => {
    setConflicto(false)
    invalidarTrasEscritura(clienteConsultas)
    alRecargarActual.current?.()
  }, [clienteConsultas])
  const descartarConflicto = useCallback(() => setConflicto(false), [])

  const mutacion = useMutation({
    mutationFn: ejecutar,
    onSuccess: (resultado, cuerpo) => {
      invalidarTrasEscritura(clienteConsultas)
      setConflicto(false)
      alExito(resultado, cuerpo)
    },
    onError: (error, cuerpo) => {
      const codigo = codigoDeError(error)
      if (codigo === 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION' && !cuerpo.confirmarStockNegativo) {
        setConfirmacion({ detalle: leerDetalleStockNegativo(error instanceof ErrorApi ? error.detalle : undefined), cuerpo })
        return
      }
      if (esConflicto(error)) {
        setConflicto(true)
        return
      }
      setConflicto(false)
      alError(error, cuerpo)
    },
  })

  return {
    enviando: mutacion.isPending,
    enviar: (cuerpo: C) => {
      setConflicto(false)
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
    /** Hubo un conflicto entre usuarios: mostrar AvisoConflicto. */
    hayConflicto: conflicto,
    /** "Reintentar": vuelve a cargar los datos; no reenvía nada. */
    recargar,
    /** Cierra el aviso del conflicto sin recargar. */
    descartarConflicto,
  }
}
