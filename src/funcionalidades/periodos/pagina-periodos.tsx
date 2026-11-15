// Periodos (docs/UI-UX.md §5.9): doce tarjetas del año (GET /periodos?anio). Todos ven; A y C cierran y reabren;
// solo A cierra en bloque. Cerrar: solo si el mes anterior no está abierto (enero: lo valida la API) y no es un mes
// futuro. Reabrir: solo el último mes cerrado. La API valida igual (PERIODO_ANTERIOR_ABIERTO, PERIODO_FUTURO…).
import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { CalendarCheckIcon, LayersIcon, XIcon } from 'lucide-react'
import { DialogoCerrarBloque } from './dialogo-cerrar-bloque'
import { DialogoCerrarMes } from './dialogo-cerrar-mes'
import { DialogoReabrir } from './dialogo-reabrir'
import { ListaMovimientos } from './lista-movimientos'
import { TarjetaPeriodo } from './tarjeta-periodo'
import { accionesPorMes, nombreCampoCierre } from './utilidades'
import { useAlertasKardex } from '@/api/kardex'
import { usePeriodos, type ResultadoCierre } from '@/api/periodos'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Aviso } from '@/componentes/comunes/aviso'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { Button } from '@/componentes/ui/button'
import { Skeleton } from '@/componentes/ui/skeleton'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearPeriodo } from '@/lib/formato'
import { anioDeUrl } from '@/lib/periodos'
import { usePuede } from '@/lib/roles'

type Resultado = { titulo: string; cierres: ResultadoCierre[] }

export function PaginaPeriodos() {
  useTituloPagina('Periodos')
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros)
  const periodos = usePeriodos(anio)
  const alertas = useAlertasKardex(anio)
  const puedeCerrar = usePuede('periodos:cerrar')
  const puedeBloque = usePuede('periodos:cerrar-en-bloque')
  const puedeCierreAnual = usePuede('periodos:cierre-anual')

  const cerrar = useDialogo<number>()
  const reabrir = useDialogo<number>()
  const bloque = useDialogo()
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const avisoResultado = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)

  const mostrarResultado = (titulo: string, cierres: ResultadoCierre[]) => {
    toast.success(titulo)
    const conAvisos = cierres.some((c) => c.saldosNegativos.length > 0 || c.diferenciasConCierreAnterior.length > 0)
    setResultado(conAvisos ? { titulo, cierres } : null)
  }

  const meses = periodos.data?.meses ?? []
  const { cerrables, reabrible } = accionesPorMes(meses)

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        refTitulo={titulo}
        titulo="Periodos"
        descripcion="Cierre mensual: un mes cerrado ya no admite registros ni cambios hasta que se reabra."
        acciones={(
          <>
            {puedeBloque && (
              <Button type="button" variant="outline" onClick={(e) => bloque.abrir(undefined, e.currentTarget)}>
                <LayersIcon aria-hidden="true" />
                Cerrar en bloque
              </Button>
            )}
            {puedeCierreAnual && (
              <Button asChild variant="outline">
                <Link to={`${RAIZ_MODULO}/periodos/cierre-anual?anio=${anio}`}>
                  <CalendarCheckIcon aria-hidden="true" />
                  Cierre anual {anio}
                </Link>
              </Button>
            )}
          </>
        )}
      />

      <SelectorPeriodo anio={anio} alCambiarAnio={(nuevo) => setParametros({ anio: String(nuevo) }, { replace: true })} />

      {resultado && (
        <div ref={avisoResultado} tabIndex={-1} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Aviso tono="advertencia" titulo={`${resultado.titulo}, con advertencias`}
            acciones={(
              <Button type="button" variant="ghost" size="sm" aria-label="Cerrar el aviso" onClick={() => setResultado(null)}>
                <XIcon aria-hidden="true" />
              </Button>
            )}>
            {resultado.cierres.map((c) => (
              <div key={c.periodo.periodo} className="mt-1 flex flex-col gap-1">
                {c.saldosNegativos.length > 0 && (
                  <>
                    <p>{formatearPeriodo(c.periodo.anio, c.periodo.mes)}: saldos negativos (no impidieron el cierre)</p>
                    <ListaMovimientos alerta="STOCK_NEGATIVO" anio={c.periodo.anio} mes={c.periodo.mes}
                      movimientos={c.saldosNegativos.map((s) => ({ ...s, documento: null }))} />
                  </>
                )}
                {c.diferenciasConCierreAnterior.length > 0 && (
                  <p>
                    {formatearPeriodo(c.periodo.anio, c.periodo.mes)}: {c.diferenciasConCierreAnterior.length} totales cambiaron respecto del
                    cierre anterior ({[...new Set(c.diferenciasConCierreAnterior.map((d) => nombreCampoCierre(d.campo)))].join(', ')}). Revisa el libro 12.1 y el asiento.
                  </p>
                )}
              </div>
            ))}
          </Aviso>
        </div>
      )}

      {periodos.isError ? (
        <EstadoError mensaje={mensajeDeError(periodos.error)} alReintentar={() => void periodos.refetch()} />
      ) : !periodos.data ? (
        <div role="status" className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <span className="sr-only">Cargando los periodos…</span>
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <>
          {periodos.data.anioCompletoCerrado && (
            <Aviso tono="exito" titulo={`Los 12 meses de ${anio} están cerrados.`}>
              {puedeCierreAnual ? 'Ya puedes hacer el cierre anual para pasar el saldo inicial al año siguiente.' : null}
            </Aviso>
          )}
          <ul className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={`Meses de ${anio}`}>
            {meses.map((p) => (
              <li key={p.periodo} className="flex">
                <TarjetaPeriodo
                  periodo={p}
                  puedeCerrar={puedeCerrar && cerrables.has(p.mes)}
                  puedeReabrir={puedeCerrar && reabrible === p.mes}
                  alCerrar={(origen) => cerrar.abrir(p.mes, origen)}
                  alReabrir={(origen) => reabrir.abrir(p.mes, origen)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {cerrar.datos !== undefined && (
        <DialogoCerrarMes key={`cerrar-${cerrar.apertura}`} anio={anio} mes={cerrar.datos} abierto={cerrar.abierto}
          alCambiarAbierto={cerrar.cambiarAbierto} focoAlCerrar={cerrar.disparador} alertas={alertas.data?.alertas ?? []}
          alCerrar={(r) => mostrarResultado(`${formatearPeriodo(r.periodo.anio, r.periodo.mes)} cerrado`, [r])}
          enfocarTrasCerrar={() => (avisoResultado.current ?? titulo.current)?.focus()} />
      )}
      {reabrir.datos !== undefined && (
        <DialogoReabrir key={`reabrir-${reabrir.apertura}`} anio={anio} mes={reabrir.datos} abierto={reabrir.abierto}
          alCambiarAbierto={reabrir.cambiarAbierto} focoAlCerrar={reabrir.disparador} />
      )}
      {puedeBloque && (
        <DialogoCerrarBloque key={`bloque-${bloque.apertura}`} anio={anio} abierto={bloque.abierto}
          alCambiarAbierto={bloque.cambiarAbierto} focoAlCerrar={bloque.disparador}
          alCerrar={(r) => mostrarResultado(
            r.cierres.length === 1 ? 'Se cerró 1 mes' : `Se cerraron ${r.cierres.length} meses`, r.cierres)} />
      )}
    </div>
  )
}
