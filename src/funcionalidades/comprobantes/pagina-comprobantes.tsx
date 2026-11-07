// Comprobantes (docs/UI-UX.md §5.7). La API pagina y filtra: fechas, naturaleza, tercero, producto, estado y
// búsqueda por serie o número. Acciones: Ver (panel lateral con las líneas y su efecto en el kardex), Editar
// (A, C; S solo compras y ventas) y Anular (A, C; motivo obligatorio). Los anulados, tachados y en gris.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EyeIcon, PencilIcon, XIcon } from 'lucide-react'
import Big from 'big.js'
import { DetalleComprobante, EstadoComprobante } from './detalle-comprobante'
import { DialogoAnular } from './dialogo-anular'
import { documentoComprobante, nombreOperacion, type TerceroElegido } from './esquemas'
import {
  useComprobantes, type Comprobante, type EstadoComprobante as Estado, type FiltrosComprobantes, type Naturaleza,
} from '@/api/comprobantes'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { CampoFecha } from '@/componentes/comunes/campo-fecha'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { SelectorProducto } from '@/componentes/comunes/selector-producto'
import { SelectorTercero } from '@/componentes/comunes/selector-tercero'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/componentes/ui/sheet'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearFecha, formatearToneladas } from '@/lib/formato'
import { puede, puedeEditarComprobante } from '@/lib/roles'
import { useSesion } from '@/lib/sesion'
import { cn } from 'cn'

const TAMANO = 50
const ESPERA_BUSQUEDA_MS = 300

/** Toneladas del comprobante (suma de sus líneas) para la columna TN: vista con big.js, no un saldo. */
const toneladasDe = (c: Comprobante) => c.lineas.reduce((suma, l) => suma.plus(l.cantidad), new Big(0)).toFixed(4)

const productosDe = (c: Comprobante) => [...new Set(c.lineas.map((l) => l.productoCodigo))]

export function PaginaComprobantes() {
  useTituloPagina('Comprobantes')
  const id = useId()
  const navegar = useNavigate()
  const { usuario } = useSesion()
  const roles = useMemo(() => usuario?.roles ?? [], [usuario])
  const puedeAnular = puede('comprobantes:anular', roles)
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [naturaleza, setNaturaleza] = useState<Naturaleza | ''>('')
  const [estado, setEstado] = useState<Estado | ''>('')
  const [tercero, setTercero] = useState<TerceroElegido | null>(null)
  const [productoId, setProductoId] = useState('')
  const [pagina, setPagina] = useState(1)
  const tituloPagina = useRef<HTMLHeadingElement>(null)
  const panel = useDialogo<Comprobante>()
  const anular = useDialogo<Comprobante>()
  const { abrir: abrirPanel } = panel
  const { abrir: abrirAnular } = anular

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setQ(texto.trim())
      setPagina(1)
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [texto])

  const filtros: FiltrosComprobantes = {
    pagina,
    tamano: TAMANO,
    q: q || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
    naturaleza: naturaleza || undefined,
    estado: estado || undefined,
    terceroId: tercero?.id,
    productoId: productoId ? Number.parseInt(productoId, 10) : undefined,
  }
  const consulta = useComprobantes(filtros)
  const hayFiltros = !!(q || desde || hasta || naturaleza || estado || tercero || productoId)

  const conFiltro = <T,>(asignar: (valor: T) => void) => (valor: T) => {
    asignar(valor)
    setPagina(1)
  }

  const columnas = useMemo<ColumnaTabla<Comprobante>[]>(() => {
    const anulado = (c: Comprobante) => c.estado === 'ANULADO' && 'line-through'
    return [
      { id: 'fecha', encabezado: 'Fecha', celda: (c) => <span className={cn('tabular-nums', anulado(c))}>{formatearFecha(c.fecha)}</span> },
      { id: 'tipo', encabezado: 'Tipo', celda: (c) => <span className={cn(anulado(c))}>{nombreOperacion(c)}</span> },
      {
        id: 'documento',
        encabezado: 'Serie-Número',
        celda: (c) => <span className={cn('font-mono', anulado(c))}>{documentoComprobante(c)}</span>,
      },
      { id: 'tercero', encabezado: 'Tercero', celda: (c) => <span className={cn(anulado(c))}>{c.tercero?.razonSocial ?? '—'}</span> },
      {
        id: 'productos',
        encabezado: 'Productos',
        celda: (c) => (
          <span className="flex flex-wrap gap-1">
            {productosDe(c).map((codigo) => <Badge key={codigo} variant="outline" className="font-mono">{codigo}</Badge>)}
          </span>
        ),
      },
      {
        id: 'tn',
        encabezado: 'TN',
        numerica: true,
        celda: (c) => <span className={cn(anulado(c))}>{formatearToneladas(toneladasDe(c))}</span>,
      },
      { id: 'moneda', encabezado: 'Moneda', valor: (c) => c.moneda },
      { id: 'estado', encabezado: 'Estado', celda: (c) => <EstadoComprobante comprobante={c} /> },
      {
        id: 'acciones',
        encabezado: 'Acciones',
        celda: (c) => {
          const documento = documentoComprobante(c)
          return (
            <span className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" aria-label={`Ver ${documento}`} onClick={(e) => abrirPanel(c, e.currentTarget)}>
                <EyeIcon aria-hidden="true" />
                Ver
              </Button>
              {puedeEditarComprobante(c, roles) && (
                <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${documento}`}
                  onClick={() => void navegar(`${RAIZ_MODULO}/comprobantes/${encodeURIComponent(c.id)}?editar=1`)}>
                  <PencilIcon aria-hidden="true" />
                  Editar
                </Button>
              )}
              {puedeAnular && c.estado === 'REGISTRADO' && (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" aria-label={`Anular ${documento}`}
                  onClick={(e) => abrirAnular(c, e.currentTarget)}>
                  <XIcon aria-hidden="true" />
                  Anular
                </Button>
              )}
            </span>
          )
        },
      },
    ]
  }, [roles, puedeAnular, abrirPanel, abrirAnular, navegar])

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        refTitulo={tituloPagina}
        titulo="Comprobantes"
        descripcion="Compras, ventas, exportaciones, mermas, desmedros y ajustes. Ver muestra el efecto en el kardex."
      />
      {consulta.isError && <EstadoError mensaje={mensajeDeError(consulta.error)} alReintentar={() => void consulta.refetch()} />}
      <TablaDatos
        titulo="Comprobantes"
        columnas={columnas}
        datos={consulta.data?.datos}
        idFila={(c) => c.id}
        cargando={consulta.isPending}
        ayudaBusqueda="Serie o número"
        busqueda={{ valor: texto, alCambiar: setTexto }}
        paginacionServidor={{ pagina, tamano: TAMANO, total: consulta.data?.total ?? 0, alCambiarPagina: setPagina }}
        filaAtenuada={(c) => c.estado === 'ANULADO'}
        vacio={hayFiltros ? 'No hay comprobantes con esos filtros.' : (
          <span className="flex flex-col items-center gap-2">
            Aún no hay comprobantes.
            {puede('compras:registrar', roles) && (
              <Button asChild size="sm" variant="outline"><Link to={`${RAIZ_MODULO}/compras/nueva`}>Registrar compra</Link></Button>
            )}
          </span>
        )}
        filtros={(
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-desde`} className="text-sm font-medium">Desde</label>
              <CampoFecha id={`${id}-desde`} className="w-40" value={desde} max={hasta || undefined}
                onChange={(e) => conFiltro(setDesde)(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-hasta`} className="text-sm font-medium">Hasta</label>
              <CampoFecha id={`${id}-hasta`} className="w-40" value={hasta} min={desde || undefined}
                onChange={(e) => conFiltro(setHasta)(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-naturaleza`} className="text-sm font-medium">Naturaleza</label>
              <CampoSelect id={`${id}-naturaleza`} className="w-36" value={naturaleza} vacio="Todas"
                onChange={(e) => conFiltro(setNaturaleza)(e.target.value as Naturaleza | '')}
                opciones={[
                  { valor: 'COMPRA', texto: 'Compras' }, { valor: 'VENTA', texto: 'Ventas' },
                  { valor: 'MERMA', texto: 'Mermas' }, { valor: 'AJUSTE', texto: 'Ajustes' },
                ]} />
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
              <label htmlFor={`${id}-tercero`} className="text-sm font-medium">Tercero</label>
              <div className="flex min-w-0 gap-1">
                <SelectorTercero id={`${id}-tercero`} valor={tercero} alCambiar={conFiltro(setTercero)} textoVacio="RUC o razón social" />
                {tercero && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar el filtro de tercero" onClick={() => conFiltro(setTercero)(null)}>
                    <XIcon aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-56">
              <label htmlFor={`${id}-producto`} className="text-sm font-medium">Producto</label>
              <SelectorProducto id={`${id}-producto`} value={productoId} valorActual={productoId}
                onChange={(e) => conFiltro(setProductoId)(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-estado`} className="text-sm font-medium">Estado</label>
              <CampoSelect id={`${id}-estado`} className="w-36" value={estado} vacio="Todos"
                onChange={(e) => conFiltro(setEstado)(e.target.value as Estado | '')}
                opciones={[{ valor: 'REGISTRADO', texto: 'Registrados' }, { valor: 'ANULADO', texto: 'Anulados' }]} />
            </div>
          </div>
        )}
      />

      <Sheet open={panel.abierto} onOpenChange={panel.cambiarAbierto}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-4xl"
          onCloseAutoFocus={(evento) => {
            if (!panel.disparador.current) return
            evento.preventDefault()
            panel.disparador.current.focus()
          }}
        >
          {panel.datos && (
            <>
              <SheetHeader>
                <SheetTitle>{nombreOperacion(panel.datos)} {documentoComprobante(panel.datos)}</SheetTitle>
                <SheetDescription>
                  <Link className="underline underline-offset-2" to={`${RAIZ_MODULO}/comprobantes/${encodeURIComponent(panel.datos.id)}`}>
                    Abrir el comprobante
                  </Link>
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <DetalleComprobante comprobante={panel.datos} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {puedeAnular && (
        <DialogoAnular
          comprobante={anular.datos}
          abierto={anular.abierto}
          alCambiarAbierto={anular.cambiarAbierto}
          focoAlCerrar={anular.disparador}
          // El botón «Anular» desaparece de la fila al quedar anulado: el foco pasa al título de la página.
          alAnular={() => setTimeout(() => tituloPagina.current?.focus(), 0)}
        />
      )}
    </div>
  )
}
