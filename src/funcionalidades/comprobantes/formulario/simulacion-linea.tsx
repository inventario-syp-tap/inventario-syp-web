// "Disponible al 15/03/2026: 25.0000 TN · costo estimado S/ 1,500.00" junto a una línea de venta
// (docs/UI-UX.md §5.4): POST /comprobantes/simular-salida 400 ms después de escribir. No guarda nada.
// Si la salida deja negativo se avisa con ícono y texto; al guardar, la API decide (política de stock).
import { useEffect, useState } from 'react'
import { OctagonXIcon } from 'lucide-react'
import { useSimulacionSalida, type DatosSimularSalida } from '@/api/comprobantes'
import { formatearFecha, formatearSoles, formatearToneladas } from '@/lib/formato'

export const ESPERA_SIMULACION_MS = 400

const RE_CANTIDAD = /^\d+(\.\d{1,4})?$/
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

type Props = { productoId: string; cantidad: string; fecha: string; establecimientoId: string }

/** Texto estable de la consulta (o null si aún falta algo), para esperar a que se deje de escribir. */
function claveSimulacion({ productoId, cantidad, fecha, establecimientoId }: Props): string | null {
  if (!productoId || !RE_CANTIDAD.test(cantidad.trim()) || /^0+(\.0*)?$/.test(cantidad.trim()) || !RE_FECHA.test(fecha)) return null
  const datos: DatosSimularSalida = {
    productoId: Number.parseInt(productoId, 10),
    fecha,
    cantidad: cantidad.trim(),
    ...(establecimientoId ? { establecimientoId: Number.parseInt(establecimientoId, 10) } : {}),
  }
  return JSON.stringify(datos)
}

export function SimulacionLinea(props: Props) {
  const clave = claveSimulacion(props)
  const [claveDiferida, setClaveDiferida] = useState<string | null>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => setClaveDiferida(clave), ESPERA_SIMULACION_MS)
    return () => clearTimeout(temporizador)
  }, [clave])

  const vigente = clave !== null && clave === claveDiferida
  const consulta = useSimulacionSalida(vigente ? (JSON.parse(clave) as DatosSimularSalida) : null)
  const simulacion = vigente ? consulta.data : undefined

  return (
    <div className="min-h-4 text-xs text-muted-foreground">
      {vigente && consulta.isFetching && !simulacion && <p>Consultando el stock disponible…</p>}
      {vigente && consulta.isError && <p>No se pudo consultar el stock disponible.</p>}
      {/* Solo el resultado se anuncia (no el "Consultando…" de cada pausa al escribir). */}
      <p aria-live="polite">
        {simulacion && (
          <>
            Disponible al {formatearFecha(simulacion.fecha)}: {formatearToneladas(simulacion.disponibleAntes)} TN · costo
            estimado {formatearSoles(simulacion.costoEstimado)}
            {simulacion.quedaNegativo && (
              <span className="ml-2 inline-flex items-center gap-1 font-medium text-destructive">
                <OctagonXIcon aria-hidden="true" className="size-3.5" />
                Queda en negativo ({formatearToneladas(simulacion.saldoResultante)} TN)
              </span>
            )}
          </>
        )}
      </p>
    </div>
  )
}
