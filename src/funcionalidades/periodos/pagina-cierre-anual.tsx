// Cierre anual (docs/UI-UX.md §5.10), asistente de 3 pasos (A, C):
//  1. verificación de los 12 meses cerrados (CierreAnualVistaDto.mesesAbiertos);
//  2. vista previa: saldo inicial propuesto del año siguiente frente al existente, diferencias resaltadas y con signo;
//  3. confirmación explícita: reemplazar (confirmarReemplazo) o conservar (conservarExistentes) los existentes que
//     difieren, y confirmarStockNegativo cuando corresponde.
// SALDO_INICIAL_REQUIERE_CONFIRMACION → vuelve al paso 2 con el mensaje. Todos los importes los calcula la API.
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeftIcon, ArrowRightIcon, CircleCheckIcon, EqualIcon, OctagonXIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'
import { ListaMovimientos } from './lista-movimientos'
import { conSigno, negativo } from './utilidades'
import { invalidarTrasEscritura } from '@/api/claves'
import { textoProducto, useProductos } from '@/api/productos'
import {
  confirmarCierreAnual, useVistaCierreAnual, type DatosCierreAnual, type ResultadoCierreAnual, type SaldoCierreAnual,
} from '@/api/periodos'
import { NOMBRE_ORIGEN } from '@/api/saldos-iniciales'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Aviso } from '@/componentes/comunes/aviso'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { Cifra } from '@/componentes/comunes/cifra'
import { DialogoStockNegativo } from '@/componentes/comunes/dialogo-stock-negativo'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { IconoAlerta } from '@/componentes/comunes/icono-alerta'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { Button } from '@/componentes/ui/button'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Spinner } from '@/componentes/ui/spinner'
import { codigoDeError, ErrorApi, esConflicto, mensajeDeError } from '@/lib/errores'
import { anioActual, anioDeUrl, textoAnioMes } from '@/lib/periodos'
import { leerDetalleStockNegativo, type DetalleStockNegativo } from '@/lib/stock-negativo'

type Paso = 1 | 2 | 3
type Decision = 'reemplazar' | 'conservar'

const COMPARACION: Record<SaldoCierreAnual['comparacion'], { texto: string; icono: typeof EqualIcon; clase: string }> = {
  IGUAL: { texto: 'Igual', icono: EqualIcon, clase: 'text-muted-foreground' },
  DIFERENTE: { texto: 'Diferente', icono: TriangleAlertIcon, clase: 'text-warning' },
  INEXISTENTE: { texto: 'Nuevo', icono: PlusIcon, clase: 'text-primary' },
}

const ACCION: Record<SaldoCierreAnual['accion'], string> = {
  CREAR: 'Se crea',
  REEMPLAZAR: 'Se reemplaza',
  CONSERVAR: 'Se conserva el existente',
  CAMBIAR_ORIGEN: 'Pasa a origen Cierre anual',
  SIN_CAMBIOS: 'Sin cambios',
}

/** Diferencia con signo explícito; si es negativa, como Cifra: en rojo, con ícono y "negativo" para lectores. */
function Diferencia({ valor, decimales }: { valor: string | null | undefined; decimales: number }) {
  if (valor === null || valor === undefined) return <span className="text-muted-foreground">—</span>
  const esNegativo = negativo(valor)
  return (
    <span className={cn('inline-flex items-center justify-end gap-1 tabular-nums', esNegativo && 'text-destructive')}>
      {esNegativo && <OctagonXIcon aria-hidden="true" className="size-3.5 shrink-0" />}
      {conSigno(valor, decimales)}
      {esNegativo && <span className="sr-only"> (negativo)</span>}
    </span>
  )
}

function TablaSaldos({ saldos, anio, nombreProducto, hecho }: {
  saldos: readonly SaldoCierreAnual[]
  anio: number
  nombreProducto: (id: number, codigo: string) => string
  hecho?: boolean
}) {
  const th = 'h-8 px-2 font-medium whitespace-nowrap'
  const td = 'h-8 px-2 whitespace-nowrap'
  return (
    <div className="overflow-x-auto rounded-md border text-[13px]">
      <table className="w-full min-w-[64rem]">
        <caption className="p-2 text-left text-sm font-medium">
          Saldo inicial de {anio + 1} propuesto (cantidad a 4 decimales y costo a 2) frente al existente
        </caption>
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th scope="col" className={cn(th, 'text-left')}>Producto</th>
            <th scope="col" className={cn(th, 'text-right')}>Saldo final {anio} TN</th>
            <th scope="col" className={cn(th, 'text-right')}>Saldo final S/</th>
            <th scope="col" className={cn(th, 'text-right')}>Propuesto TN</th>
            <th scope="col" className={cn(th, 'text-right')}>Propuesto S/</th>
            <th scope="col" className={cn(th, 'text-right')}>Existente TN</th>
            <th scope="col" className={cn(th, 'text-right')}>Existente S/</th>
            <th scope="col" className={cn(th, 'text-right')}>Diferencia TN</th>
            <th scope="col" className={cn(th, 'text-right')}>Diferencia S/</th>
            <th scope="col" className={cn(th, 'text-left')}>Comparación</th>
            <th scope="col" className={cn(th, 'text-left')}>{hecho ? 'Resultado' : 'Al confirmar'}</th>
          </tr>
        </thead>
        <tbody>
          {saldos.map((s) => {
            const comparacion = COMPARACION[s.comparacion]
            const Icono = comparacion.icono
            const diferente = s.comparacion === 'DIFERENTE'
            return (
              <tr key={`${s.productoId}-${s.establecimientoId}`} className={cn('border-t', diferente && 'bg-warning/10 font-medium')}>
                <th scope="row" className={cn(td, 'text-left font-normal')}>{nombreProducto(s.productoId, s.productoCodigo)}</th>
                <td className={cn(td, 'text-right')}><Cifra tipo="toneladas" valor={s.saldoFinal.cantidad} /></td>
                <td className={cn(td, 'text-right')}><Cifra tipo="importe" valor={s.saldoFinal.costoTotal} /></td>
                <td className={cn(td, 'text-right')}><Cifra tipo="toneladas" valor={s.propuesto.cantidad} /></td>
                <td className={cn(td, 'text-right')}><Cifra tipo="importe" valor={s.propuesto.costoTotal} /></td>
                <td className={cn(td, 'text-right')}>
                  {s.existente ? <Cifra tipo="toneladas" valor={s.existente.cantidad} /> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className={cn(td, 'text-right')}>
                  {s.existente ? (
                    <span className="inline-flex flex-col items-end">
                      <Cifra tipo="importe" valor={s.existente.costoTotal} />
                      <span className="text-xs font-normal text-muted-foreground">
                        {NOMBRE_ORIGEN[s.existente.origen]}
                      </span>
                      {s.existente.desactualizado && <IconoAlerta codigo="SI_DESACTUALIZADO" />}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className={cn(td, 'text-right')}><Diferencia valor={s.diferencia?.cantidad} decimales={4} /></td>
                <td className={cn(td, 'text-right')}><Diferencia valor={s.diferencia?.costoTotal} decimales={2} /></td>
                <td className={td}>
                  <span className="inline-flex items-center gap-1">
                    <Icono aria-hidden="true" className={cn('size-3.5', comparacion.clase)} />
                    {comparacion.texto}
                  </span>
                </td>
                <td className={td}>{ACCION[s.accion]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function PaginaCierreAnual() {
  useTituloPagina('Cierre anual')
  const id = useId()
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros, anioActual() - 1)
  const clienteConsultas = useQueryClient()
  const vista = useVistaCierreAnual(anio)
  const productos = useProductos()

  const [paso, setPaso] = useState<Paso>(1)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [confirmarNegativo, setConfirmarNegativo] = useState(false)
  const [mensajePaso2, setMensajePaso2] = useState<string | null>(null)
  const [errorDecision, setErrorDecision] = useState<string | null>(null)
  const [detalleNegativo, setDetalleNegativo] = useState<DetalleStockNegativo | null>(null)
  const [pedirNegativo, setPedirNegativo] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCierreAnual | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const botonConfirmar = useRef<HTMLButtonElement>(null)
  const primeraOpcion = useRef<HTMLInputElement>(null)

  // Cada cambio de paso lleva el foco al título del paso (los botones del paso anterior desaparecen).
  const tituloPaso = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    tituloPaso.current?.focus()
  }, [paso])

  const nombreProducto = (idProducto: number, codigo: string) => {
    const producto = productos.data?.find((p) => p.id === idProducto)
    return producto ? textoProducto(producto) : codigo
  }

  const datos = vista.data
  const requiereDecision = !!datos?.requiereConfirmacion || !!datos?.saldos.some((s) => s.comparacion === 'DIFERENTE')
  const propuestoNegativo = !!datos?.saldos.some((s) => negativo(s.propuesto.cantidad))
  const mostrarCasillaNegativo = propuestoNegativo || pedirNegativo

  const reiniciar = (siguienteAnio?: number) => {
    setPaso(1)
    setDecision(null)
    setConfirmarNegativo(false)
    setMensajePaso2(null)
    setErrorDecision(null)
    setPedirNegativo(false)
    setResultado(null)
    confirmar.reset()
    if (siguienteAnio !== undefined) setParametros({ anio: String(siguienteAnio) }, { replace: true })
  }

  const confirmar = useMutation({
    mutationFn: (cuerpo: DatosCierreAnual) => confirmarCierreAnual(anio, cuerpo),
    onSuccess: (r) => {
      invalidarTrasEscritura(clienteConsultas)
      setResultado(r)
      toast.success(`Cierre anual de ${r.anio} registrado · saldo inicial de ${r.anioSiguiente} actualizado`)
      setTimeout(() => titulo.current?.focus(), 0)
    },
    onError: (error) => {
      const codigo = codigoDeError(error)
      if (codigo === 'SALDO_INICIAL_REQUIERE_CONFIRMACION') {
        const conAnio = error instanceof ErrorApi
          ? new ErrorApi(error.status, error.codigo, error.message, { anioSiguiente: anio + 1, ...error.detalle })
          : error
        setMensajePaso2(mensajeDeError(conAnio))
        setDecision(null)
        void vista.refetch()
        setPaso(2)
        return
      }
      if (codigo === 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION') {
        setDetalleNegativo(leerDetalleStockNegativo(error instanceof ErrorApi ? error.detalle : undefined))
        setPedirNegativo(true)
        return
      }
      if (codigo === 'CIERRE_ANUAL_INCOMPLETO') {
        void vista.refetch()
        setPaso(1)
      }
    },
  })

  const enviar = (stockNegativo: boolean) => {
    if (requiereDecision && !decision) {
      setErrorDecision('Elige qué hacer con los saldos iniciales existentes que son distintos.')
      primeraOpcion.current?.focus()
      return
    }
    const cuerpo: DatosCierreAnual = {}
    if (decision === 'reemplazar') cuerpo.confirmarReemplazo = true
    if (decision === 'conservar') cuerpo.conservarExistentes = true
    if (stockNegativo) cuerpo.confirmarStockNegativo = true
    confirmar.mutate(cuerpo)
  }

  const errorConfirmar = confirmar.error
  const codigoConfirmar = codigoDeError(errorConfirmar)
  const errorVisible = errorConfirmar && !esConflicto(errorConfirmar)
    && codigoConfirmar !== 'SALDO_INICIAL_REQUIERE_CONFIRMACION' && codigoConfirmar !== 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION'

  const PASOS = ['Verificar los meses', 'Revisar el saldo inicial', 'Confirmar']

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to={`${RAIZ_MODULO}/periodos?anio=${anio}`}>
            <ArrowLeftIcon aria-hidden="true" />
            Periodos
          </Link>
        </Button>
      </div>
      <EncabezadoPagina
        refTitulo={titulo}
        titulo={`Cierre anual ${anio}`}
        descripcion={`Pasa el saldo final de ${anio} como saldo inicial de ${anio + 1}. Los importes los calcula el sistema.`}
      />
      <SelectorPeriodo anio={anio} alCambiarAnio={(nuevo) => reiniciar(nuevo)} />

      {resultado ? (
        <section className="flex flex-col gap-3" aria-labelledby={`${id}-resultado`}>
          <h2 id={`${id}-resultado`} className="text-base font-semibold">Resultado</h2>
          <Aviso tono="exito" titulo={`Cierre anual de ${resultado.anio} registrado.`}>
            Saldo inicial de {resultado.anioSiguiente} actualizado; {resultado.kardexRecalculados} kardex de {resultado.anioSiguiente} recalculados.
          </Aviso>
          <TablaSaldos saldos={resultado.saldos} anio={resultado.anio} nombreProducto={nombreProducto} hecho />
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link to={`${RAIZ_MODULO}/saldos-iniciales?anio=${resultado.anioSiguiente}`}>Ver saldos iniciales de {resultado.anioSiguiente}</Link></Button>
            <Button type="button" variant="outline" onClick={() => reiniciar()}>Volver al inicio del asistente</Button>
          </div>
        </section>
      ) : (
        <>
          <ol className="flex flex-wrap gap-2 text-sm" aria-label="Pasos del cierre anual">
            {PASOS.map((nombre, i) => {
              const numero = (i + 1) as Paso
              const actual = numero === paso
              return (
                <li key={nombre} aria-current={actual ? 'step' : undefined}
                  className={cn('flex items-center gap-2 rounded-full border px-3 py-1', actual ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                  {numero < paso ? <CircleCheckIcon aria-hidden="true" className="size-4" /> : <span aria-hidden="true">{numero}.</span>}
                  {nombre}
                  {numero < paso && <span className="sr-only"> (hecho)</span>}
                </li>
              )
            })}
          </ol>

          {confirmar.isError && esConflicto(confirmar.error) && (
            <AvisoConflicto alReintentar={() => {
              confirmar.reset()
              invalidarTrasEscritura(clienteConsultas)
              setPaso(1)
            }} />
          )}

          {vista.isError ? (
            <EstadoError mensaje={mensajeDeError(vista.error)} alReintentar={() => void vista.refetch()} />
          ) : !datos ? (
            <div role="status" className="flex flex-col gap-2">
              <span className="sr-only">Cargando la vista previa…</span>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <section className="flex flex-col gap-3" aria-labelledby={`${id}-paso`}>
              <h2 id={`${id}-paso`} ref={tituloPaso} tabIndex={-1}
                className="rounded-sm text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                Paso {paso} de 3: {PASOS[paso - 1]}
              </h2>

              {paso === 1 && (
                <>
                  {datos.mesesAbiertos.length > 0 ? (
                    <Aviso tono="error" titulo={mensajeDeError(new ErrorApi(409, 'CIERRE_ANUAL_INCOMPLETO', ''))}>
                      Meses abiertos: {datos.mesesAbiertos.map(textoAnioMes).join(', ')}.{' '}
                      <Link className="text-foreground underline underline-offset-2" to={`${RAIZ_MODULO}/periodos?anio=${anio}`}>Ir a Periodos</Link>
                    </Aviso>
                  ) : (
                    <Aviso tono="exito" titulo={`Los 12 meses de ${anio} están cerrados.`} />
                  )}
                  <div>
                    <Button type="button" disabled={datos.mesesAbiertos.length > 0} onClick={() => setPaso(2)}>
                      Siguiente
                      <ArrowRightIcon aria-hidden="true" />
                    </Button>
                  </div>
                </>
              )}

              {paso === 2 && (
                <>
                  {mensajePaso2 && <Aviso tono="advertencia" titulo={mensajePaso2} />}
                  {propuestoNegativo && (
                    <Aviso tono="advertencia" titulo={`El saldo inicial propuesto de ${anio + 1} tiene stock negativo.`}>
                      <ListaMovimientos alerta="STOCK_NEGATIVO" anio={anio + 1} mes={1}
                        movimientos={datos.saldos.filter((s) => negativo(s.propuesto.cantidad)).map((s) => ({
                          movimientoId: null, productoId: s.productoId, productoCodigo: s.productoCodigo, fecha: null, saldoCantidad: s.propuesto.cantidad,
                        }))} />
                    </Aviso>
                  )}
                  {datos.saldos.length === 0 ? (
                    <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">No hay saldos de {anio} que pasar a {anio + 1}.</p>
                  ) : (
                    <TablaSaldos saldos={datos.saldos} anio={anio} nombreProducto={nombreProducto} />
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setPaso(1)}>
                      <ArrowLeftIcon aria-hidden="true" />
                      Anterior
                    </Button>
                    <Button type="button" onClick={() => setPaso(3)}>
                      Siguiente
                      <ArrowRightIcon aria-hidden="true" />
                    </Button>
                  </div>
                </>
              )}

              {paso === 3 && (
                <>
                  {requiereDecision ? (
                    <fieldset className="flex flex-col gap-2 rounded-md border p-3" aria-describedby={errorDecision ? `${id}-decision-error` : undefined}>
                      <legend className="px-1 text-sm font-medium">
                        El saldo inicial de {anio + 1} ya existe y es distinto en algunos productos. ¿Qué hacemos?
                      </legend>
                      {([
                        ['reemplazar', 'Reemplazar el saldo inicial existente', `Se usa el propuesto y se recalcula el kardex de ${anio + 1}.`],
                        ['conservar', 'Conservar los existentes', 'Se mantienen (p. ej. los manuales) y la diferencia queda en la auditoría.'],
                      ] as const).map(([valor, etiqueta, ayuda]) => (
                        <label key={valor} className="flex items-start gap-2 text-sm">
                          <input type="radio" name={`${id}-decision`} value={valor} checked={decision === valor}
                            ref={valor === 'reemplazar' ? primeraOpcion : undefined}
                            aria-invalid={!!errorDecision}
                            className="mt-1 size-4 accent-primary"
                            aria-describedby={`${id}-${valor}-ayuda`}
                            onChange={() => {
                              setDecision(valor)
                              setErrorDecision(null)
                            }} />
                          <span>
                            {etiqueta}
                            <span id={`${id}-${valor}-ayuda`} className="block text-xs text-muted-foreground">{ayuda}</span>
                          </span>
                        </label>
                      ))}
                      {errorDecision && <p id={`${id}-decision-error`} role="alert" className="text-sm text-destructive">{errorDecision}</p>}
                    </fieldset>
                  ) : (
                    <Aviso tono="info" titulo={`Se creará o actualizará el saldo inicial de ${anio + 1} con lo propuesto en el paso 2.`} />
                  )}
                  {mostrarCasillaNegativo && (
                    <CampoCasilla id={`${id}-negativo`} etiqueta={`Confirmo que el saldo inicial deja stock negativo en ${anio + 1}`}
                      marcado={confirmarNegativo} alCambiar={setConfirmarNegativo} />
                  )}
                  {errorVisible && <Aviso tono="error" titulo={mensajeDeError(errorConfirmar)} />}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={confirmar.isPending} onClick={() => setPaso(2)}>
                      <ArrowLeftIcon aria-hidden="true" />
                      Anterior
                    </Button>
                    <Button ref={botonConfirmar} type="button" disabled={confirmar.isPending || (mostrarCasillaNegativo && !confirmarNegativo)}
                      onClick={() => enviar(mostrarCasillaNegativo && confirmarNegativo)}>
                      {confirmar.isPending && <Spinner aria-hidden="true" />}
                      {confirmar.isPending ? 'Confirmando…' : `Confirmar el cierre anual de ${anio}`}
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

      <DialogoStockNegativo
        abierto={detalleNegativo !== null}
        alCambiarAbierto={(abierto) => { if (!abierto) setDetalleNegativo(null) }}
        detalle={detalleNegativo}
        producto={detalleNegativo?.productoId
          ? nombreProducto(detalleNegativo.productoId, `producto ${detalleNegativo.productoId}`)
          : null}
        alConfirmar={() => {
          setDetalleNegativo(null)
          setConfirmarNegativo(true)
          enviar(true)
        }}
        focoAlCerrar={botonConfirmar}
      />
    </div>
  )
}
