// Productos (docs/UI-UX.md §5.16) con el stock actual por establecimiento (GET /productos/stock).
// Ver: todos · crear y editar: ADMIN y CONTADOR (lib/roles.ts → 'productos:editar'). El código no se edita.
// El stock lo calcula la API (último movimiento registrado): aquí solo se muestra.
import { useId, useMemo, useState } from 'react'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { DialogoProducto } from './dialogo-producto'
import { useEstablecimientos } from '@/api/establecimientos'
import { useProductos, useStock, type Producto, type StockProducto } from '@/api/productos'
import { useTituloPagina } from '@/app/titulo-pagina'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { Cifra } from '@/componentes/comunes/cifra'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoActivo } from '@/componentes/comunes/estado-activo'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { IconoAlerta } from '@/componentes/comunes/icono-alerta'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Button } from '@/componentes/ui/button'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearFecha } from '@/lib/formato'
import { usePuede } from '@/lib/roles'

type FilaProducto = Producto & { stock: StockProducto | undefined }

export function PaginaProductos() {
  useTituloPagina('Productos')
  const idEstablecimiento = useId()
  const puedeEditar = usePuede('productos:editar')
  const dialogo = useDialogo<Producto>()
  const { abrir } = dialogo
  const [elegido, setElegido] = useState<number | null>(null)

  const productos = useProductos()
  const establecimientos = useEstablecimientos()
  const activos = establecimientos.data?.filter((e) => e.activo) ?? []
  const establecimientoId = elegido ?? activos[0]?.id
  // Espera la lista de establecimientos para pedir el stock del elegido (y no dos veces).
  const stock = useStock(establecimientoId, !establecimientos.isPending)

  // Une cada producto con su fila de stock del establecimiento elegido (solo se juntan datos de la API).
  const filas: FilaProducto[] | undefined = productos.data?.map((p) => ({
    ...p,
    stock: stock.data?.find((s) => s.productoId === p.id && (establecimientoId === undefined || s.establecimientoId === establecimientoId)),
  }))

  const columnas = useMemo<ColumnaTabla<FilaProducto>[]>(() => {
    const lista: ColumnaTabla<FilaProducto>[] = [
      { id: 'codigo', encabezado: 'Código', valor: (p) => p.codigo, celda: (p) => <span className="font-mono">{p.codigo}</span> },
      { id: 'codigoLibro', encabezado: 'Código libro', valor: (p) => p.codigoLibro, celda: (p) => <span className="font-mono">{p.codigoLibro}</span> },
      { id: 'descripcion', encabezado: 'Descripción', valor: (p) => p.descripcion },
      { id: 'tablas', encabezado: 'T5 · T6 · T14', celda: (p) => <span className="font-mono">{p.tipoExistencia} · {p.unidadMedida} · {p.metodoValuacion}</span> },
      {
        id: 'cuentas',
        encabezado: 'Cuentas',
        valor: (p) => `${p.cuentaInventario} ${p.cuentaCostoVentas}`,
        celda: (p) => (
          <span className="font-mono text-xs">
            <span className="sr-only">Existencias </span>{p.cuentaInventario} · <span className="sr-only">Costo de ventas </span>{p.cuentaCostoVentas}
          </span>
        ),
      },
      { id: 'stock', encabezado: 'Stock TN', numerica: true, ordenable: false, celda: (p) => (p.stock ? <Cifra valor={p.stock.cantidad} tipo="toneladas" /> : '—') },
      { id: 'valor', encabezado: 'Valor S/', numerica: true, ordenable: false, celda: (p) => (p.stock ? <Cifra valor={p.stock.costoTotal} tipo="soles" /> : '—') },
      { id: 'cu', encabezado: 'CU S/ x TN', numerica: true, ordenable: false, celda: (p) => (p.stock ? <Cifra valor={p.stock.costoUnitario} tipo="cu" /> : '—') },
      { id: 'al', encabezado: 'Último mov.', celda: (p) => formatearFecha(p.stock?.fechaUltimoMovimiento) },
      {
        id: 'alertas',
        encabezado: 'Alertas',
        celda: (p) => (p.stock?.alertas.length
          ? <span className="flex flex-col gap-0.5">{p.stock.alertas.map((a) => <IconoAlerta key={a} codigo={a} />)}</span>
          : <span className="text-muted-foreground">Ninguna</span>),
      },
      { id: 'activo', encabezado: 'Estado', celda: (p) => <EstadoActivo activo={p.activo} /> },
    ]
    if (puedeEditar) {
      lista.push({
        id: 'acciones',
        encabezado: 'Acciones',
        celda: (p) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Editar ${p.codigo}`}
            onClick={(evento) => abrir(p, evento.currentTarget)}
          >
            <PencilIcon aria-hidden="true" />
            Editar
          </Button>
        ),
      })
    }
    return lista
  }, [puedeEditar, abrir])

  const error = productos.error ?? stock.error
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Productos"
        descripcion="Stock al último movimiento registrado, calculado por la API (promedio ponderado)."
        acciones={puedeEditar && (
          <Button type="button" onClick={(evento) => abrir(undefined, evento.currentTarget)}>
            <PlusIcon aria-hidden="true" />
            Nuevo producto
          </Button>
        )}
      />
      {error && (
        <EstadoError
          mensaje={mensajeDeError(error)}
          alReintentar={() => { void productos.refetch(); void stock.refetch() }}
        />
      )}
      <TablaDatos
        titulo="Productos y su stock"
        columnas={columnas}
        datos={filas}
        idFila={(p) => String(p.id)}
        cargando={productos.isPending}
        ayudaBusqueda="Código o descripción"
        filaAtenuada={(p) => !p.activo}
        vacio="Aún no hay productos."
        filtros={activos.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={idEstablecimiento} className="text-sm font-medium">Establecimiento (stock)</label>
            <CampoSelect
              id={idEstablecimiento}
              className="w-56"
              value={establecimientoId === undefined ? '' : String(establecimientoId)}
              onChange={(evento) => setElegido(Number.parseInt(evento.target.value, 10))}
              opciones={activos.map((e) => ({ valor: String(e.id), texto: e.textoLibro }))}
            />
          </div>
        )}
      />
      {puedeEditar && (
        <DialogoProducto
          key={dialogo.apertura}
          abierto={dialogo.abierto}
          alCambiarAbierto={dialogo.cambiarAbierto}
          producto={dialogo.datos}
          focoAlCerrar={dialogo.disparador}
        />
      )}
    </div>
  )
}
