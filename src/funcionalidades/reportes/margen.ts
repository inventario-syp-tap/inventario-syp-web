// Funciones puras del reporte de Margen (sin componentes ni recharts; se prueban aparte).
import Big from 'big.js'
import type { MargenMes } from '@/api/reportes'

const esCero = (valor: string) => {
  try {
    return new Big(valor).eq(0)
  } catch {
    return false
  }
}

/**
 * true si ningún mes del año tiene ventas con valor de venta (todas las "ventas S/" en 0) o si el año no tiene meses:
 * el margen no se puede calcular y en lugar del gráfico va un aviso. big.js solo compara con cero (no calcula).
 */
export function sinVentasConPrecio(meses: readonly MargenMes[]): boolean {
  return meses.filter((m) => m.mes !== null).every((m) => esCero(m.ventasSoles))
}
