// Detalle de una toma de inventario (todos ven): datos, paso 3 (diferencias: saldo del sistema a la fecha, contado,
// diferencia y tipo, todo calculado por la API) y paso 4 (A, C): acciones por producto y «Resolver», y luego
// «Cerrar toma». Enlaces a la merma y al ajuste generados. Una toma reemplazada por otra posterior de la misma fecha
// (tras «Volver a calcular») ya no se resuelve: se enlaza a la nueva.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeftIcon, LockIcon } from 'lucide-react'
import { EstadoToma, Pasos, TipoDiferencia, TituloPaso } from './componentes-toma'
import { FormularioResolver } from './formulario-resolver'
import { TEXTO_ACCION } from './utilidades'
import { CLAVES } from '@/api/claves'
import { cerrarToma, lineasConDiferencia, tomasReemplazadas, useToma, useTomas } from '@/api/tomas-inventario'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Aviso } from '@/componentes/comunes/aviso'
import { Cifra } from '@/componentes/comunes/cifra'
import { DialogoConfirmacion } from '@/componentes/comunes/dialogo-confirmacion'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Button } from '@/componentes/ui/button'
import { Skeleton } from '@/componentes/ui/skeleton'
import { useDialogo } from '@/hooks/use-dialogo'
import { codigoDeError, mensajeDeError } from '@/lib/errores'
import { formatearFecha, formatearFechaHora } from '@/lib/formato'
import { anioActual } from '@/lib/periodos'
import { usePuede } from '@/lib/roles'

const RUTA = `${RAIZ_MODULO}/toma-inventario`

export function PaginaDetalleToma() {
  useTituloPagina('Detalle de la toma')
  const { id } = useParams()
  const toma = useToma(id)
  const anio = toma.data ? Number.parseInt(toma.data.fecha.slice(0, 4), 10) : anioActual()
  const delAnio = useTomas(anio)
  const puedeGestionar = usePuede('tomas:gestionar')
  const clienteConsultas = useQueryClient()
  const confirmar = useDialogo()
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const refTitulo = useRef<HTMLHeadingElement>(null)
  const refPaso4 = useRef<HTMLHeadingElement>(null)

  // Al resolver, el formulario (con el botón que tenía el foco) se desmonta: el foco pasa al título del paso 4,
  // donde ahora está «Cerrar toma».
  const listaParaCerrar = toma.data
    ? toma.data.estado !== 'CERRADA' && (toma.data.resuelta || lineasConDiferencia(toma.data).length === 0)
    : null
  const listaAntes = useRef(listaParaCerrar)
  useEffect(() => {
    if (listaAntes.current === false && listaParaCerrar === true) refPaso4.current?.focus()
    listaAntes.current = listaParaCerrar
  }, [listaParaCerrar])

  const cierre = useMutation({
    mutationFn: (idToma: string) => cerrarToma(idToma),
    onSuccess: () => {
      toast.success('Toma de inventario cerrada')
      setErrorCierre(null)
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.tomas })
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.dashboard })
      // El botón «Cerrar toma» desaparece: el foco pasa al título.
      refTitulo.current?.focus()
    },
    onError: (error) => {
      const codigo = codigoDeError(error)
      if (codigo === 'TOMA_YA_CERRADA' || codigo === 'TOMA_CON_DIFERENCIAS_PENDIENTES') {
        void clienteConsultas.invalidateQueries({ queryKey: CLAVES.tomas })
      }
      setErrorCierre(mensajeDeError(error))
    },
  })

  if (toma.isError) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoPagina titulo="Toma de inventario" />
        <EstadoError mensaje={mensajeDeError(toma.error)} alReintentar={() => void toma.refetch()} />
        <Link className="w-fit text-sm underline underline-offset-2" to={RUTA}>Volver a las tomas</Link>
      </div>
    )
  }
  if (!toma.data) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Cargando la toma…</span>
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const t = toma.data
  const reemplazo = tomasReemplazadas(delAnio.data ?? []).get(t.id)
  const conDiferencia = lineasConDiferencia(t)
  const cerrada = t.estado === 'CERRADA'
  const sePuedeCerrar = !cerrada && (t.resuelta || conDiferencia.length === 0)
  const gestionable = puedeGestionar && !cerrada && !reemplazo
  const titulo = `Toma del ${formatearFecha(t.fecha)}`

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo={titulo}
        refTitulo={refTitulo}
        descripcion={<EstadoToma toma={t} reemplazadaPor={reemplazo} />}
        acciones={(
          <Button asChild variant="outline">
            <Link to={`${RUTA}?anio=${anio}`}><ArrowLeftIcon aria-hidden="true" />Volver a las tomas</Link>
          </Button>
        )}
      />
      <Pasos actual={sePuedeCerrar ? 4 : 3} completo={cerrada} />

      <dl className="grid max-w-2xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Fecha</dt>
        <dd className="tabular-nums">{formatearFecha(t.fecha)}</dd>
        <dt className="text-muted-foreground">Responsable</dt>
        <dd>{t.responsable}</dd>
        {t.observacion && (<><dt className="text-muted-foreground">Observación</dt><dd>{t.observacion}</dd></>)}
        <dt className="text-muted-foreground">Registrada</dt>
        <dd>{formatearFechaHora(t.creadoEn)}{t.creadoPor ? ` · ${t.creadoPor}` : ''}</dd>
      </dl>

      {reemplazo && (
        <Aviso tono="info" titulo={`Reemplazada por la toma del ${formatearFechaHora(reemplazo.creadoEn)}`}>
          Esta toma quedó desactualizada y se volvió a calcular.{' '}
          <Link className="text-foreground underline underline-offset-2" to={`${RUTA}/${reemplazo.id}`}>Ir a la toma vigente</Link>
        </Aviso>
      )}

      <section className="flex flex-col gap-2">
        <TituloPaso numero={3}>Diferencias</TituloPaso>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[48rem] text-sm">
            <caption className="sr-only">Diferencias de la toma del {formatearFecha(t.fecha)}: saldo del sistema, contado y diferencia en TN</caption>
            <thead className="bg-muted">
              <tr className="text-left">
                <th scope="col" className="px-3 py-2">Producto</th>
                <th scope="col" className="px-3 py-2 text-right">Sistema (TN)</th>
                <th scope="col" className="px-3 py-2 text-right">Contado (TN)</th>
                <th scope="col" className="px-3 py-2 text-right">Diferencia (TN)</th>
                <th scope="col" className="px-3 py-2">Tipo</th>
                <th scope="col" className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {t.lineas.map((l) => (
                <tr key={l.productoId} className="border-t align-top">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="font-medium">{l.productoCodigo}</span>
                    <span className="block text-xs text-muted-foreground">{l.productoDescripcion}</span>
                  </th>
                  <td className="px-3 py-2 text-right"><Cifra tipo="toneladas" valor={l.cantidadSistema} /></td>
                  <td className="px-3 py-2 text-right"><Cifra tipo="toneladas" valor={l.cantidadContada} /></td>
                  <td className="px-3 py-2 text-right"><Cifra tipo="toneladas" valor={l.diferencia} /></td>
                  <td className="px-3 py-2"><TipoDiferencia linea={l} /></td>
                  <td className="px-3 py-2">
                    {l.accion ? (
                      <span className="flex flex-col">
                        <span>{TEXTO_ACCION[l.accion]}</span>
                        {l.comprobante && (
                          <Link className="w-fit font-mono text-xs underline underline-offset-2" to={`${RAIZ_MODULO}/comprobantes/${l.comprobante.id}`}>
                            {l.comprobante.documento}
                          </Link>
                        )}
                        {l.observacion && <span className="text-xs text-muted-foreground">{l.observacion}</span>}
                      </span>
                    ) : <span className="text-muted-foreground">{l.tipoDiferencia === 'SIN_DIFERENCIA' ? '—' : 'Pendiente'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {t.comprobantes.length > 0 && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium">Comprobantes generados</h2>
          <ul className="flex flex-col gap-0.5">
            {t.comprobantes.map((c) => (
              <li key={c.id}>
                {c.naturaleza === 'MERMA' ? 'Merma' : 'Ajuste'}:{' '}
                <Link className="font-mono underline underline-offset-2" to={`${RAIZ_MODULO}/comprobantes/${c.id}`}>{c.documento}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gestionable && (
        <section className="flex flex-col gap-3">
          <TituloPaso numero={4} refTitulo={refPaso4}>Acciones y cierre</TituloPaso>
          {!sePuedeCerrar ? (
            <FormularioResolver key={t.id} toma={t} />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {conDiferencia.length === 0
                  ? 'No hay diferencias con el sistema: la toma se puede cerrar directamente.'
                  : 'Todas las diferencias tienen su acción. Cierra la toma para terminar.'}
              </p>
              {errorCierre && <EstadoError mensaje={errorCierre} />}
              <div>
                <Button type="button" aria-disabled={cierre.isPending || undefined}
                  onClick={(e) => { if (!cierre.isPending) confirmar.abrir(undefined, e.currentTarget) }}>
                  <LockIcon aria-hidden="true" />
                  Cerrar toma
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      <DialogoConfirmacion
        abierto={confirmar.abierto}
        alCambiarAbierto={confirmar.cambiarAbierto}
        titulo={`Cerrar la ${titulo.toLowerCase()}`}
        descripcion="La toma quedará cerrada y ya no se podrá modificar. Los comprobantes generados no cambian."
        textoConfirmar="Cerrar toma"
        alConfirmar={() => cierre.mutate(t.id)}
        focoAlCerrar={confirmar.disparador}
      />
    </div>
  )
}
