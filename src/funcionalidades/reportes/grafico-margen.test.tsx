// Margen sin ventas con valor de venta: aviso en lugar del gráfico vacío (la tabla por producto la prueba
// pagina-reporte.test.tsx). Solo se renderiza la rama del aviso: recharts necesita medir y jsdom no tiene layout.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GraficoMargen } from './grafico-margen'
import { sinVentasConPrecio } from './margen'
import type { MargenMes } from '@/api/reportes'

const mes = (numero: number | null, datos: Partial<MargenMes> = {}): MargenMes => ({
  mes: numero, ventasCantidad: '0.0000', ventasSoles: '0', costoVentas: '0', margen: '0', porcentaje: null,
  sinPrecio: { cantidad: '0.0000', costo: '0' }, ...datos,
})

describe('sinVentasConPrecio', () => {
  it('true si todas las ventas S/ del año están en 0 (también "0.00") o si no hay meses', () => {
    expect(sinVentasConPrecio([mes(1), mes(2, { ventasSoles: '0.00' })])).toBe(true)
    expect(sinVentasConPrecio([])).toBe(true)
    // La fila del total (mes null) no cuenta como mes.
    expect(sinVentasConPrecio([mes(null, { ventasSoles: '500' })])).toBe(true)
  })

  it('false si al menos un mes tiene ventas S/ > 0', () => {
    expect(sinVentasConPrecio([mes(1), mes(2, { ventasSoles: '18000' })])).toBe(false)
  })
})

describe('GraficoMargen sin ventas con valor de venta', () => {
  it('muestra el aviso con las ventas sin precio del año, no el gráfico', () => {
    const meses = [mes(1, { sinPrecio: { cantidad: '2.0000', costo: '2160' } }), mes(2, { sinPrecio: { cantidad: '1.5000', costo: '1620' } })]
    const total = mes(null, { sinPrecio: { cantidad: '3.5000', costo: '3780' } })
    render(<GraficoMargen anio={2026} meses={meses} total={total} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'En 2026 no hay ventas con valor de venta registrado, por eso no se puede calcular el margen. Ventas sin precio: 3.5000 TN (costo S/ 3,780.00).')
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
  })

  it('un año sin meses con datos muestra el mismo aviso con 0.0000 TN y S/ 0.00', () => {
    render(<GraficoMargen anio={2025} meses={[]} total={mes(null)} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'En 2025 no hay ventas con valor de venta registrado, por eso no se puede calcular el margen. Ventas sin precio: 0.0000 TN (costo S/ 0.00).')
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
  })
})
