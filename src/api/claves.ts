// Claves de TanStack Query por recurso. Cada pantalla agrega sus filtros detrás: [...CLAVES.kardex, { anio }].
import type { QueryClient } from '@tanstack/react-query'

export const CLAVES = {
  kardex: ['kardex'],
  alertas: ['kardex-alertas'],
  stock: ['stock'],
  dashboard: ['dashboard'],
  periodos: ['periodos'],
  saldosIniciales: ['saldos-iniciales'],
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
 * kardex, alertas, stock, dashboard, periodos, saldos iniciales y comprobantes.
 */
export const CLAVES_AFECTADAS_POR_ESCRITURA = [
  CLAVES.kardex,
  CLAVES.alertas,
  CLAVES.stock,
  CLAVES.dashboard,
  CLAVES.periodos,
  CLAVES.saldosIniciales,
  CLAVES.comprobantes,
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
