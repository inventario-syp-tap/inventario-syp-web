// Comprobantes: compras, ventas y exportaciones, mermas y desmedros, ajustes (docs/CONTRATO-API.md §6.3).
// Ver: todos · registrar compra y venta: A, C, S · merma, desmedro y ajuste: A, C · editar: A, C (S: sus compras
// y ventas) · anular: A, C. Cantidades, costos, precios y tipo de cambio viajan siempre como string decimal.
import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query'
import { CLAVES, CLAVES_AFECTADAS_POR_ESCRITURA } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type Comprobante = components['schemas']['ComprobanteDto']
export type LineaComprobante = components['schemas']['LineaComprobanteDto']
export type PaginaComprobantes = components['schemas']['ComprobantesPaginaDto']
export type ResultadoEscritura = components['schemas']['ResultadoEscrituraDto']
export type Naturaleza = Comprobante['naturaleza']
export type EstadoComprobante = Comprobante['estado']
export type DatosCompra = components['schemas']['CrearCompraDto']
export type DatosVenta = components['schemas']['CrearVentaDto']
export type DatosMerma = components['schemas']['CrearMermaDto']
export type DatosAjuste = components['schemas']['CrearAjusteDto']
export type DatosEditarComprobante = components['schemas']['EditarComprobanteDto']
export type DatosAnular = components['schemas']['AnularComprobanteDto']
export type DatosSimularSalida = components['schemas']['SimularSalidaDto']
export type SimulacionSalida = components['schemas']['SimulacionSalidaDto']

export type FiltrosComprobantes = {
  pagina?: number
  tamano?: number
  naturaleza?: Naturaleza
  desde?: string
  hasta?: string
  terceroId?: number
  productoId?: number
  estado?: EstadoComprobante
  q?: string
}

/** Lo que se puede reenviar con la confirmación de stock negativo. */
export type CuerpoConConfirmacion = { confirmarStockNegativo?: boolean }

export const listarComprobantes = ({ pagina = 1, tamano = 50, q, ...filtros }: FiltrosComprobantes = {}) =>
  solicitar<PaginaComprobantes>(`/comprobantes${consultaUrl({ pagina, tamano, q: q?.trim(), ...filtros })}`)

export const obtenerComprobante = (id: string) => solicitar<Comprobante>(`/comprobantes/${encodeURIComponent(id)}`)

export const registrarCompra = (datos: DatosCompra) =>
  solicitar<ResultadoEscritura>('/comprobantes/compras', { metodo: 'POST', cuerpo: datos })

export const registrarVenta = (datos: DatosVenta) =>
  solicitar<ResultadoEscritura>('/comprobantes/ventas', { metodo: 'POST', cuerpo: datos })

export const registrarMerma = (datos: DatosMerma) =>
  solicitar<ResultadoEscritura>('/comprobantes/mermas', { metodo: 'POST', cuerpo: datos })

export const registrarAjuste = (datos: DatosAjuste) =>
  solicitar<ResultadoEscritura>('/comprobantes/ajustes', { metodo: 'POST', cuerpo: datos })

export const editarComprobante = (id: string, datos: DatosEditarComprobante) =>
  solicitar<ResultadoEscritura>(`/comprobantes/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos })

export const anularComprobante = (id: string, datos: DatosAnular) =>
  solicitar<ResultadoEscritura>(`/comprobantes/${encodeURIComponent(id)}/anular`, { metodo: 'POST', cuerpo: datos })

/** No guarda nada: disponible antes y costo estimado de una salida. */
export const simularSalida = (datos: DatosSimularSalida, senal?: AbortSignal) =>
  solicitar<SimulacionSalida>('/comprobantes/simular-salida', { metodo: 'POST', cuerpo: datos, senal })

export function useComprobantes(filtros: FiltrosComprobantes) {
  return useQuery({
    queryKey: [...CLAVES.comprobantes, 'lista', filtros],
    queryFn: () => listarComprobantes(filtros),
    placeholderData: keepPreviousData,
  })
}

export function useComprobante(id: string | undefined) {
  return useQuery({
    queryKey: [...CLAVES.comprobantes, 'detalle', id],
    queryFn: () => obtenerComprobante(id ?? ''),
    enabled: !!id,
  })
}

/** Simulación de una salida (vista previa en la línea de venta). Va bajo `comprobantes`: se invalida al guardar. */
export function useSimulacionSalida(datos: DatosSimularSalida | null) {
  return useQuery({
    queryKey: [...CLAVES.comprobantes, 'simular-salida', datos],
    queryFn: ({ signal }) => simularSalida(datos as DatosSimularSalida, signal),
    enabled: datos !== null,
    staleTime: 30_000,
  })
}

/** Después de registrar, editar o anular: kardex, stock, dashboard, periodos, comprobantes y productos (stock). */
export function invalidarTrasEscritura(clienteConsultas: QueryClient) {
  for (const clave of [...CLAVES_AFECTADAS_POR_ESCRITURA, CLAVES.productos]) {
    void clienteConsultas.invalidateQueries({ queryKey: clave })
  }
}
