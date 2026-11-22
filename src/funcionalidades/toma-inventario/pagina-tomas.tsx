// Toma de inventario — lista por año (docs/UI-UX.md §5.15). Todos ven; A y C crean y resuelven. Una toma en
// BORRADOR que tiene otra posterior con la misma fecha (la que se creó al «Volver a calcular» una toma
// desactualizada) se marca "Reemplazada por la toma del <fecha y hora>" y desde la lista ya no se ofrece resolverla.
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ClipboardCheckIcon, EyeIcon, PlusIcon } from 'lucide-react'
import { EstadoToma } from './componentes-toma'
import { lineasConDiferencia, tomasReemplazadas, useTomas, type Toma } from '@/api/tomas-inventario'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Button } from '@/componentes/ui/button'
import { mensajeDeError } from '@/lib/errores'
import { formatearEntero, formatearFecha, formatearFechaHora } from '@/lib/formato'
import { anioDeUrl } from '@/lib/periodos'
import { usePuede } from '@/lib/roles'

const RUTA = `${RAIZ_MODULO}/toma-inventario`

export function PaginaTomas() {
  useTituloPagina('Toma de inventario')
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros)
  const tomas = useTomas(anio)
  const puedeGestionar = usePuede('tomas:gestionar')
  const reemplazadas = useMemo(() => tomasReemplazadas(tomas.data ?? []), [tomas.data])

  const columnas = useMemo<ColumnaTabla<Toma>[]>(() => [
    { id: 'fecha', encabezado: 'Fecha', valor: (t) => t.fecha, celda: (t) => <span className="tabular-nums">{formatearFecha(t.fecha)}</span> },
    { id: 'responsable', encabezado: 'Responsable', valor: (t) => t.responsable },
    {
      id: 'diferencias',
      encabezado: 'Productos con diferencia',
      numerica: true,
      valor: (t) => lineasConDiferencia(t).length,
      celda: (t) => <span className="tabular-nums">{formatearEntero(lineasConDiferencia(t).length)} de {formatearEntero(t.lineas.length)}</span>,
    },
    { id: 'estado', encabezado: 'Estado', celda: (t) => <EstadoToma toma={t} reemplazadaPor={reemplazadas.get(t.id)} /> },
    {
      id: 'comprobantes',
      encabezado: 'Comprobantes generados',
      celda: (t) => (t.comprobantes.length === 0 ? <span className="text-muted-foreground">—</span> : (
        <ul className="flex flex-col gap-0.5">
          {t.comprobantes.map((c) => (
            <li key={c.id}>
              <Link className="font-mono text-xs underline underline-offset-2" to={`${RAIZ_MODULO}/comprobantes/${c.id}`}
                aria-label={`Ver ${c.naturaleza === 'MERMA' ? 'la merma' : 'el ajuste'} ${c.documento}`}>
                {c.documento}
              </Link>
            </li>
          ))}
        </ul>
      )),
    },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      celda: (t) => {
        const resolver = puedeGestionar && t.estado === 'BORRADOR' && !reemplazadas.has(t.id)
        const texto = resolver ? (t.resuelta ? 'Cerrar' : 'Resolver') : 'Ver'
        return (
          <Button asChild variant="ghost" size="sm">
            <Link to={`${RUTA}/${t.id}`} aria-label={`${texto} la toma del ${formatearFecha(t.fecha)} registrada el ${formatearFechaHora(t.creadoEn)}`}>
              {resolver ? <ClipboardCheckIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
              {texto}
            </Link>
          </Button>
        )
      },
    },
  ], [puedeGestionar, reemplazadas])

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Toma de inventario"
        descripcion="Conteo físico (pesado) por producto frente al saldo del sistema a esa fecha. Las diferencias se resuelven con una merma o un ajuste."
        acciones={puedeGestionar && (
          <Button asChild>
            <Link to={`${RUTA}/nueva`}>
              <PlusIcon aria-hidden="true" />
              Nueva toma
            </Link>
          </Button>
        )}
      />
      <SelectorPeriodo anio={anio} alCambiarAnio={(a) => setParametros({ anio: String(a) }, { replace: true })} />
      {tomas.isError ? (
        <EstadoError mensaje={mensajeDeError(tomas.error)} alReintentar={() => void tomas.refetch()} />
      ) : (
        <TablaDatos
          titulo={`Tomas de inventario de ${anio}`}
          columnas={columnas}
          datos={tomas.data}
          idFila={(t) => t.id}
          cargando={tomas.isPending}
          filaAtenuada={(t) => reemplazadas.has(t.id)}
          vacio={(
            <span>
              Aún no hay tomas de inventario en {anio}.{' '}
              {puedeGestionar && <Link className="underline underline-offset-2" to={`${RUTA}/nueva`}>Registrar una toma</Link>}
            </span>
          )}
        />
      )}
    </div>
  )
}
