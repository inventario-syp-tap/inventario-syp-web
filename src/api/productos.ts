// Productos (docs/CONTRATO-API.md §6.2). Ver: todos · crear y editar: ADMIN y CONTADOR. El código no cambia.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'

export type Producto = components['schemas']['ProductoDto']
export type StockProducto = components['schemas']['StockProductoDto']
export type DatosCrearProducto = components['schemas']['CrearProductoDto']
export type DatosEditarProducto = components['schemas']['EditarProductoDto']

/** "FIERRO · Chatarra pesada" (selects y mensajes). */
export const textoProducto = (producto: Pick<Producto, 'codigo' | 'descripcion'>) => `${producto.codigo} · ${producto.descripcion}`

export const listarProductos = () => solicitar<Producto[]>('/productos')

/** Stock actual por producto y establecimiento (sin filtro: todos los establecimientos). */
export function listarStock(establecimientoId?: number) {
  const consulta = establecimientoId ? `?establecimientoId=${establecimientoId}` : ''
  return solicitar<StockProducto[]>(`/productos/stock${consulta}`)
}

export const crearProducto = (datos: DatosCrearProducto) =>
  solicitar<Producto>('/productos', { metodo: 'POST', cuerpo: datos })

export const editarProducto = (id: number, datos: DatosEditarProducto) =>
  solicitar<Producto>(`/productos/${id}`, { metodo: 'PATCH', cuerpo: datos })

export function useProductos() {
  return useQuery({ queryKey: CLAVES.productos, queryFn: listarProductos })
}

export function useStock(establecimientoId?: number, habilitado = true) {
  return useQuery({
    queryKey: [...CLAVES.stock, { establecimientoId: establecimientoId ?? null }],
    queryFn: () => listarStock(establecimientoId),
    enabled: habilitado,
  })
}
