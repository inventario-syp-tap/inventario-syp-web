// Gráfico de barras simple del margen (docs/UI-UX.md §5.12): ventas S/ y costo de ventas S/ por mes del total de
// productos, en un solo eje (misma unidad). recharts 3 ya estaba en el stack (sin dependencias nuevas).
// Los importes se convierten a number con big.js SOLO para dibujar las barras: no se calcula nada; el tooltip
// muestra el texto exacto de la API y la tabla "TOTAL DE PRODUCTOS" es la vista accesible con las mismas cifras.
// Colores: tokens --chart-2 y --chart-3 (validados con el script de la guía de gráficos en ambos temas).
import Big from 'big.js'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { sinVentasConPrecio } from './margen'
import type { MargenMes } from '@/api/reportes'
import { Aviso } from '@/componentes/comunes/aviso'
import { formatearSoles, formatearToneladas, nombreMes } from '@/lib/formato'

type Punto = { mes: string; ventas: number; costo: number; textoVentas: string; textoCosto: string; textoMargen: string }

const aNumeroParaDibujar = (valor: string) => {
  try {
    return new Big(valor).toNumber()
  } catch {
    return 0
  }
}

const COMPACTO = new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 })

function Ayuda({ active, payload }: { active?: boolean; payload?: readonly { payload?: Punto }[] }) {
  const punto = payload?.[0]?.payload
  if (!active || !punto) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{punto.mes}</p>
      <p>Ventas: <span className="tabular-nums">{punto.textoVentas}</span></p>
      <p>Costo de ventas: <span className="tabular-nums">{punto.textoCosto}</span></p>
      <p>Margen: <span className="tabular-nums">{punto.textoMargen}</span></p>
    </div>
  )
}

/** Aviso en lugar del gráfico vacío; las cifras de ventas sin precio son el total del año que manda la API. */
function AvisoSinVentasConPrecio({ anio, meses, total }: { anio: number; meses: readonly MargenMes[]; total: MargenMes }) {
  const conMeses = meses.some((m) => m.mes !== null)
  const toneladas = formatearToneladas(conMeses ? total.sinPrecio.cantidad : '0')
  const costo = formatearSoles(conMeses ? total.sinPrecio.costo : '0')
  return (
    <Aviso tono="info"
      titulo={`En ${anio} no hay ventas con valor de venta registrado, por eso no se puede calcular el margen. Ventas sin precio: ${toneladas} TN (costo ${costo}).`} />
  )
}

export function GraficoMargen({ anio, meses, total }: { anio: number; meses: readonly MargenMes[]; total: MargenMes }) {
  if (sinVentasConPrecio(meses)) return <AvisoSinVentasConPrecio anio={anio} meses={meses} total={total} />
  const datos: Punto[] = meses
    .filter((m): m is MargenMes & { mes: number } => m.mes !== null)
    .map((m) => ({
      mes: nombreMes(m.mes).slice(0, 3),
      ventas: aNumeroParaDibujar(m.ventasSoles),
      costo: aNumeroParaDibujar(m.costoVentas),
      textoVentas: formatearSoles(m.ventasSoles),
      textoCosto: formatearSoles(m.costoVentas),
      textoMargen: formatearSoles(m.margen),
    }))
  return (
    <figure className="flex flex-col gap-2 rounded-md border p-3">
      <figcaption className="text-sm font-medium">
        Ventas y costo de ventas por mes, {anio} (S/)
        <span className="sr-only">. Las mismas cifras están en la tabla TOTAL DE PRODUCTOS.</span>
      </figcaption>
      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {/* Sin accessibilityLayer: el svg no recibe foco (está oculto; la vista accesible es la tabla). */}
          <BarChart data={datos} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="mes" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={(valor: number) => COMPACTO.format(valor)} />
            <Tooltip content={<Ayuda />} cursor={{ fill: 'var(--muted)' }} />
            {/* El color de la serie va solo en el ícono; el texto, en color de texto (contraste AA). */}
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(valor: string) => <span className="text-foreground">{valor}</span>} />
            <Bar dataKey="ventas" name="Ventas" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="costo" name="Costo de ventas" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
