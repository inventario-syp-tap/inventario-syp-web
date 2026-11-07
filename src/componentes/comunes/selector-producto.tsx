// Producto de una línea (docs/UI-UX.md §4): <select> nativo con los productos activos ("CÓDIGO · descripción").
// Si el valor actual es un producto inactivo (comprobante antiguo), igual se muestra para no perderlo.
import type { ComponentProps } from 'react'
import { CampoSelect } from './campo-select'
import { textoProducto, useProductos } from '@/api/productos'

type Props = Omit<ComponentProps<typeof CampoSelect>, 'opciones' | 'vacio'> & { valorActual?: string }

export function SelectorProducto({ valorActual, ...props }: Props) {
  const productos = useProductos()
  const lista = productos.data ?? []
  const opciones = lista
    .filter((p) => p.activo || String(p.id) === valorActual)
    .map((p) => ({ valor: String(p.id), texto: textoProducto(p) }))
  return <CampoSelect {...props} vacio={productos.isPending ? 'Cargando productos…' : 'Elige un producto'} opciones={opciones} />
}
