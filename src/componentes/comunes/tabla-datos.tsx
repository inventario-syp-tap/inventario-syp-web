// Tabla de datos (docs/UI-UX.md §4 y §7) con TanStack Table 8.
//  - Búsqueda: la tecla "/" la enfoca. Orden por columna con botones (teclado) y aria-sort en el encabezado.
//  - Dos modos de paginación:
//      cliente  → la API devuelve la lista completa (productos, reglas, establecimientos): busca, ordena y pagina aquí.
//      servidor → la API pagina (terceros, usuarios): la búsqueda y la página las controla la pantalla. Sin orden
//                 local, porque ordenar solo la página visible engañaría.
//  - <caption> (solo para lectores), scope="col", columnas numéricas a la derecha con tabular-nums, cabecera fija,
//    esqueleto mientras carga y estado vacío.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type FilterFn, type SortingState,
} from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Kbd } from '@/componentes/ui/kbd'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'
import { formatearEntero } from '@/lib/formato'

type Valor = string | number | boolean | null | undefined

export type ColumnaTabla<T> = {
  id: string
  encabezado: string
  /** Valor para ordenar y buscar (y para mostrar si no hay `celda`). */
  valor?: (fila: T) => Valor
  celda?: (fila: T) => ReactNode
  /** Alineada a la derecha con cifras tabulares. */
  numerica?: boolean
  /** Por defecto se puede ordenar si tiene `valor` (solo en paginación del cliente). */
  ordenable?: boolean
  className?: string
}

type PaginacionServidor = {
  pagina: number
  tamano: number
  total: number
  alCambiarPagina: (pagina: number) => void
}

type BusquedaControlada = { valor: string; alCambiar: (valor: string) => void }

type Props<T> = {
  /** Texto del <caption> (lo leen los lectores de pantalla). */
  titulo: string
  columnas: readonly ColumnaTabla<T>[]
  datos: readonly T[] | undefined
  idFila: (fila: T) => string
  cargando?: boolean
  /** Mensaje (y acción) cuando no hay filas. */
  vacio?: ReactNode
  /** Ayuda del buscador ("Código o descripción"). Sin ella no se muestra el buscador. */
  ayudaBusqueda?: string
  /** Modo servidor: la pantalla controla la búsqueda. */
  busqueda?: BusquedaControlada
  /** Modo servidor: la API pagina. */
  paginacionServidor?: PaginacionServidor
  /** Filas por página en modo cliente. */
  filasPorPagina?: number
  /** Controles extra junto al buscador (filtros). */
  filtros?: ReactNode
  filaAtenuada?: (fila: T) => boolean
}

/** Minúsculas y sin tildes: "Fierro" encuentra "FIÉRRO". */
const normalizar = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const esEditable = (elemento: EventTarget | null) =>
  elemento instanceof HTMLElement &&
  (elemento.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(elemento.tagName))

function IconoOrden({ orden }: { orden: false | 'asc' | 'desc' }) {
  if (orden === 'asc') return <ArrowUpIcon aria-hidden="true" className="size-3.5" />
  if (orden === 'desc') return <ArrowDownIcon aria-hidden="true" className="size-3.5" />
  return <ArrowUpDownIcon aria-hidden="true" className="size-3.5 opacity-50" />
}

const TEXTO_ORDEN = { asc: 'ascendente', desc: 'descendente' } as const

export function TablaDatos<T>({
  titulo, columnas, datos, idFila, cargando = false, vacio = 'No hay registros.', ayudaBusqueda, busqueda,
  paginacionServidor, filasPorPagina = 20, filtros, filaAtenuada,
}: Props<T>) {
  const idBuscador = useId()
  const buscador = useRef<HTMLInputElement>(null)
  const [busquedaLocal, setBusquedaLocal] = useState('')
  const [orden, setOrden] = useState<SortingState>([])
  const servidor = paginacionServidor !== undefined
  const textoBusqueda = busqueda?.valor ?? busquedaLocal
  const cambiarBusqueda = busqueda?.alCambiar ?? setBusquedaLocal

  // "/" enfoca el buscador (salvo que ya se esté escribiendo en un campo).
  useEffect(() => {
    if (!ayudaBusqueda) return
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey || esEditable(evento.target)) return
      evento.preventDefault()
      buscador.current?.focus()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [ayudaBusqueda])

  const definiciones = useMemo<ColumnDef<T, Valor>[]>(
    () =>
      columnas.map((columna) => ({
        id: columna.id,
        header: columna.encabezado,
        accessorFn: columna.valor ?? (() => null),
        enableSorting: !servidor && (columna.ordenable ?? columna.valor !== undefined),
        enableGlobalFilter: columna.valor !== undefined,
        sortUndefined: 'last',
        cell: ({ row }) => (columna.celda ? columna.celda(row.original) : String(columna.valor?.(row.original) ?? '—')),
      })),
    [columnas, servidor],
  )

  const filtroGlobal = useMemo<FilterFn<T>>(
    () => (fila, idColumna, filtro: string) => {
      const valor = fila.getValue<Valor>(idColumna)
      return valor !== null && valor !== undefined && normalizar(String(valor)).includes(normalizar(filtro.trim()))
    },
    [],
  )

  const tabla = useReactTable<T>({
    data: useMemo(() => [...(datos ?? [])], [datos]),
    columns: definiciones,
    getRowId: idFila,
    state: servidor ? {} : { sorting: orden, globalFilter: textoBusqueda },
    onSortingChange: setOrden,
    globalFilterFn: filtroGlobal,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: servidor ? undefined : getFilteredRowModel(),
    getSortedRowModel: servidor ? undefined : getSortedRowModel(),
    getPaginationRowModel: servidor ? undefined : getPaginationRowModel(),
    manualPagination: servidor,
    manualFiltering: servidor,
    initialState: { pagination: { pageIndex: 0, pageSize: filasPorPagina } },
    autoResetPageIndex: true,
  })

  const filas = tabla.getRowModel().rows
  const total = servidor ? paginacionServidor.total : tabla.getFilteredRowModel().rows.length
  const pagina = servidor ? paginacionServidor.pagina : tabla.getState().pagination.pageIndex + 1
  const tamano = servidor ? paginacionServidor.tamano : filasPorPagina
  const paginas = Math.max(1, Math.ceil(total / tamano))
  const irA = (destino: number) => {
    if (servidor) paginacionServidor.alCambiarPagina(destino)
    else tabla.setPageIndex(destino - 1)
  }
  const numerica = (id: string) => columnas.find((c) => c.id === id)?.numerica ?? false
  const claseColumna = (id: string) => columnas.find((c) => c.id === id)?.className

  return (
    <div className="flex flex-col gap-3">
      {(ayudaBusqueda || filtros) && (
        <div className="flex flex-wrap items-end gap-3">
          {ayudaBusqueda && (
            <div className="flex min-w-64 flex-col gap-1">
              <label htmlFor={idBuscador} className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={idBuscador}
                  ref={buscador}
                  type="search"
                  value={textoBusqueda}
                  onChange={(evento) => cambiarBusqueda(evento.target.value)}
                  placeholder={ayudaBusqueda}
                  aria-describedby={`${idBuscador}-atajo`}
                  className="h-9 pr-9 pl-8"
                />
                <Kbd aria-hidden="true" className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
              </div>
              <span id={`${idBuscador}-atajo`} className="sr-only">Atajo: tecla barra para buscar.</span>
            </div>
          )}
          {filtros}
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table className="text-[13px]">
          <TableCaption className="sr-only">{titulo}</TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-primary [&_tr]:border-b-0">
            {tabla.getHeaderGroups().map((grupo) => (
              <TableRow key={grupo.id} className="hover:bg-primary">
                {grupo.headers.map((encabezado) => {
                  const direccion = encabezado.column.getIsSorted()
                  const ordenable = encabezado.column.getCanSort()
                  const texto = String(encabezado.column.columnDef.header)
                  return (
                    <TableHead
                      key={encabezado.id}
                      scope="col"
                      aria-sort={ordenable ? (direccion === 'asc' ? 'ascending' : direccion === 'desc' ? 'descending' : 'none') : undefined}
                      className={cn('h-9 text-primary-foreground', numerica(encabezado.id) && 'text-right', claseColumna(encabezado.id))}
                    >
                      {ordenable ? (
                        <button
                          type="button"
                          onClick={encabezado.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground',
                            numerica(encabezado.id) && 'flex-row-reverse',
                          )}
                        >
                          {texto}
                          <IconoOrden orden={direccion} />
                          <span className="sr-only">
                            {direccion ? `, orden ${TEXTO_ORDEN[direccion]}` : ', sin orden'}. Pulsa para cambiar el orden.
                          </span>
                        </button>
                      ) : (
                        texto
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {cargando && !datos?.length ? (
              [0, 1, 2, 3, 4].map((i) => (
                <TableRow key={`esqueleto-${i}`} aria-hidden="true">
                  {columnas.map((columna) => (
                    <TableCell key={columna.id} className="py-1.5"><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnas.length} className="py-6 text-center text-sm text-muted-foreground whitespace-normal">
                  {datos === undefined
                    // Sin datos y sin carga: falló la consulta (el error se muestra arriba). No es "vacío".
                    ? 'Sin datos para mostrar.'
                    : textoBusqueda.trim() && !servidor ? `No hay resultados para «${textoBusqueda.trim()}».` : vacio}
                </TableCell>
              </TableRow>
            ) : (
              filas.map((fila) => (
                <TableRow key={fila.id} className={cn(filaAtenuada?.(fila.original) && 'text-muted-foreground')}>
                  {fila.getVisibleCells().map((celda) => (
                    <TableCell
                      key={celda.id}
                      className={cn('h-8 py-1', numerica(celda.column.id) && 'text-right tabular-nums', claseColumna(celda.column.id))}
                    >
                      {flexRender(celda.column.columnDef.cell, celda.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(paginas > 1 || servidor) && total > 0 && (
        <nav aria-label={`Paginación de ${titulo.toLowerCase()}`} className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <span className="text-muted-foreground" aria-live="polite">
            Página {formatearEntero(pagina)} de {formatearEntero(paginas)} · {formatearEntero(total)} {total === 1 ? 'registro' : 'registros'}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={pagina <= 1} onClick={() => irA(pagina - 1)}>
            <ChevronLeftIcon aria-hidden="true" />
            Anterior
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => irA(pagina + 1)}>
            Siguiente
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}
