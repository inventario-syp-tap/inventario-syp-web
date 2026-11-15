// Lista de movimientos con alerta (saldo negativo, saldo cero con costo) y su enlace a la fila del kardex.
import { Link } from 'react-router'
import { anioMesDeFecha } from '@/api/periodos'
import { IconoAlerta } from '@/componentes/comunes/icono-alerta'
import { Cifra } from '@/componentes/comunes/cifra'
import { enlaceKardex } from '@/funcionalidades/kardex/filtros-url'
import { formatearFecha } from '@/lib/formato'

export type MovimientoListado = {
  movimientoId: string | null
  productoId: number | null
  productoCodigo: string | null
  fecha: string | null
  documento?: string | null
  /** Saldo TN que queda (saldos negativos). */
  saldoCantidad?: string | null
}

type Props = {
  movimientos: readonly MovimientoListado[]
  alerta: 'STOCK_NEGATIVO' | 'SALDO_CERO_CON_COSTO'
  anio: number
  /** Para el enlace cuando el movimiento no trae fecha. */
  mes: number | null
  /** Al seguir un enlace (p. ej. cerrar el diálogo). */
  alNavegar?: () => void
}

export function ListaMovimientos({ movimientos, alerta, anio, mes, alNavegar }: Props) {
  if (movimientos.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {movimientos.map((m, i) => {
        const texto = [m.productoCodigo, m.fecha ? formatearFecha(m.fecha) : null, m.documento].filter(Boolean).join(' · ') || 'Movimiento'
        const anioMes = anioMesDeFecha(m.fecha)
        return (
          <li key={m.movimientoId ?? i} className="flex flex-wrap items-center gap-2">
            <IconoAlerta codigo={alerta} />
            {m.productoId !== null ? (
              <Link to={enlaceKardex(m.productoId, anioMes?.anio ?? anio, anioMes?.mes ?? mes, m.movimientoId)}
                onClick={alNavegar} className="font-mono text-xs underline underline-offset-2">
                {texto}
                <span className="sr-only"> (ver en el kardex)</span>
              </Link>
            ) : (
              <span className="font-mono text-xs">{texto}</span>
            )}
            {m.saldoCantidad && <span className="text-xs">saldo <Cifra tipo="toneladas" valor={m.saldoCantidad} /> TN</span>}
          </li>
        )
      })}
    </ul>
  )
}
