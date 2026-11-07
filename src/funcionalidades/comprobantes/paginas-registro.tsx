// Pantallas Registrar compra, venta o exportación, merma o desmedro y ajuste (docs/UI-UX.md §5.3 a §5.6).
// Esperan a tener establecimientos y productos (esqueleto mientras tanto) y montan el formulario con la fecha de
// hoy y el primer establecimiento activo.
import { useTituloPagina } from '@/app/titulo-pagina'
import { useEstablecimientos } from '@/api/establecimientos'
import { useProductos } from '@/api/productos'
import type { Naturaleza } from '@/api/comprobantes'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Skeleton } from '@/componentes/ui/skeleton'
import { FormularioComprobante } from './formulario/formulario-comprobante'
import { mensajeDeError } from '@/lib/errores'
import { hoyIso } from '@/lib/formato'

const TEXTOS: Record<Naturaleza, { titulo: string; descripcion: string }> = {
  COMPRA: {
    titulo: 'Registrar compra',
    descripcion: 'Factura de proveedor. Costo unitario sin IGV (hasta 6 decimales).',
  },
  VENTA: {
    titulo: 'Registrar venta o exportación',
    descripcion: 'Venta nacional (01) o exportación (17). Valor de venta unitario sin IGV; en dólares, con el tipo de cambio.',
  },
  MERMA: {
    titulo: 'Registrar merma o desmedro',
    descripcion: 'Merma (13) con informe técnico o desmedro (14) con acta de destrucción. El sustento es obligatorio.',
  },
  AJUSTE: {
    titulo: 'Registrar ajuste',
    descripcion: 'Diferencia de inventario (28). Entradas al costo promedio o con costo; salidas al promedio.',
  },
}

/** Esqueleto con la forma del formulario (nunca en blanco, docs/UI-UX.md §6). */
export function EsqueletoFormulario() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Cargando el formulario…</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function PaginaRegistro({ naturaleza }: { naturaleza: Naturaleza }) {
  const { titulo, descripcion } = TEXTOS[naturaleza]
  useTituloPagina(titulo)
  const establecimientos = useEstablecimientos()
  const productos = useProductos()
  const error = establecimientos.error ?? productos.error

  let contenido
  if (error) {
    contenido = (
      <EstadoError
        mensaje={mensajeDeError(error)}
        alReintentar={() => {
          void establecimientos.refetch()
          void productos.refetch()
        }}
      />
    )
  } else if (establecimientos.isPending || productos.isPending) {
    contenido = <EsqueletoFormulario />
  } else {
    const primero = (establecimientos.data ?? []).find((e) => e.activo)
    contenido = (
      <FormularioComprobante naturaleza={naturaleza} fechaInicial={hoyIso()} establecimientoInicial={primero ? String(primero.id) : ''} />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo={titulo} descripcion={descripcion} />
      {contenido}
    </div>
  )
}

export const PaginaCompra = () => <PaginaRegistro naturaleza="COMPRA" />
export const PaginaVenta = () => <PaginaRegistro naturaleza="VENTA" />
export const PaginaMerma = () => <PaginaRegistro naturaleza="MERMA" />
export const PaginaAjuste = () => <PaginaRegistro naturaleza="AJUSTE" />
