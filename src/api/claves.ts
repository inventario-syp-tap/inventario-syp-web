// Claves de TanStack Query por recurso. Cada pantalla agrega sus filtros detrás: [...CLAVES.kardex, { anio }].
import type { QueryClient } from '@tanstack/react-query'

export const CLAVES = {
  kardex: ['kardex'],
  alertas: ['kardex-alertas'],
  stock: ['stock'],
  dashboard: ['dashboard'],
  periodos: ['periodos'],
  saldosIniciales: ['saldos-iniciales'],
  libro121: ['libro-12-1'],
  reportes: ['reportes'],
  asientos: ['asientos'],
  controlTonelaje: ['control-tonelaje'],
  tomas: ['tomas-inventario'],
  comprobantes: ['comprobantes'],
  paridad: ['importacion', 'paridad'],
  catalogos: ['catalogos'],
  productos: ['productos'],
  terceros: ['terceros'],
  reglas: ['reglas-contables'],
  establecimientos: ['establecimientos'],
  configuracion: ['configuracion'],
  usuarios: ['usuarios'],
} as const

/**
 * Lo que cambia cuando se registra, edita, anula, reordena, recalcula o cierra algo (o se carga el histórico):
 * kardex, alertas, stock, dashboard, periodos, saldos iniciales, comprobantes, libro 12.1 (su estado de impresión puede
 * quedar desactualizado), reportes, asientos (la exportación puede quedar desactualizada), control de tonelaje
 * (compras del kardex) y tomas de inventario (una toma en borrador puede quedar desactualizada).
 */
export const CLAVES_AFECTADAS_POR_ESCRITURA = [
  CLAVES.kardex,
  CLAVES.alertas,
  CLAVES.stock,
  CLAVES.dashboard,
  CLAVES.periodos,
  CLAVES.saldosIniciales,
  CLAVES.comprobantes,
  CLAVES.libro121,
  CLAVES.reportes,
  CLAVES.asientos,
  CLAVES.controlTonelaje,
  CLAVES.tomas,
] as const

/**
 * Un solo lugar para invalidar después de escribir (y para "Reintentar" ante un conflicto: vuelve a cargar los
 * datos sin reenviar nada). Incluye productos porque su lista trae el stock.
 */
export function invalidarTrasEscritura(clienteConsultas: QueryClient) {
  for (const clave of [...CLAVES_AFECTADAS_POR_ESCRITURA, CLAVES.productos]) {
    void clienteConsultas.invalidateQueries({ queryKey: clave })
  }
}
