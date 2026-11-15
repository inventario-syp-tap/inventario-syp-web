// Filtros de los libros 12.1 y 13.1 "como el kardex" (docs/UI-UX.md §5.11 y §5.12): producto o Todos, año, mes o
// Todo el año y, en el 13.1, «Detallado» (solo A y C, D-33). Viven en la URL con el mismo formato que el kardex
// (?producto&anio&mes=N|todo&detallado=1): sin `producto` son todos los productos.
import { useId } from 'react'
import { textoProducto, useProductos } from '@/api/productos'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { Label } from '@/componentes/ui/label'
import type { FiltrosKardexUrl } from '@/funcionalidades/kardex/filtros-url'

type Props = {
  filtros: FiltrosKardexUrl
  cambiar: (cambios: Partial<FiltrosKardexUrl>) => void
  /** Muestra la casilla «Detallado» (solo cuando el rol puede pedirlo). */
  conDetallado?: boolean
}

export function FiltrosLibro({ filtros, cambiar, conDetallado = false }: Props) {
  const id = useId()
  const productos = useProductos()
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-producto`}>Producto</Label>
        <CampoSelect id={`${id}-producto`} className="w-72" value={filtros.productoId === null ? '' : String(filtros.productoId)}
          disabled={!productos.data}
          opciones={[
            { valor: '', texto: productos.isPending ? 'Cargando productos…' : 'Todos los productos' },
            ...(productos.data ?? []).map((p) => ({ valor: String(p.id), texto: `${textoProducto(p)}${p.activo ? '' : ' (inactivo)'}` })),
          ]}
          onChange={(evento) => cambiar({ productoId: evento.target.value === '' ? null : Number.parseInt(evento.target.value, 10) })} />
      </div>
      <SelectorPeriodo anio={filtros.anio} mes={filtros.mes} permitirTodoElAnio
        alCambiarAnio={(anio) => cambiar({ anio })}
        alCambiarMes={(mes) => cambiar({ mes })} />
      {conDetallado && (
        <div className="pb-2">
          <CampoCasilla id={`${id}-detallado`} etiqueta="Detallado" marcado={filtros.detallado}
            alCambiar={(detallado) => cambiar({ detallado })} aria-describedby={`${id}-detallado-ayuda`} />
          <p id={`${id}-detallado-ayuda`} className="sr-only">Agrega RUC, razón social, descripción y el subtotal compra, venta y saldo del mes.</p>
        </div>
      )}
    </div>
  )
}
