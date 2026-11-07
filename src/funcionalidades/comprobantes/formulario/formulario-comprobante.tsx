// Formulario de comprobante con varias líneas: compra, venta o exportación, merma o desmedro y ajuste, para
// registrar o editar (docs/UI-UX.md §5.3 a §5.7). Muestra y captura; la API calcula y valida.
//  - Ctrl+Enter guarda · Alt+N agrega una línea · "Guardar" deshabilitado mientras envía · foco en el primer error.
//  - Errores de la API: errores-operacion.ts decide si van junto al campo, en el encabezado, al diálogo de stock
//    negativo (reenvío con la confirmación) o con "Reintentar" (ORDEN_EN_CONFLICTO).
import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { RotateCwIcon } from 'lucide-react'
import { LineasComprobante } from './lineas-comprobante'
import { ubicarErrorOperacion, type UbicacionError } from '../errores-operacion'
import {
  aAjuste, aCompra, aEditar, aMerma, aVenta, documentoComprobante, esquemaComprobante, formatearImporte, lineaVacia,
  nombreOperacion, participio, totales, valoresDesdeComprobante, valoresNuevos, type FormularioComprobante,
} from '../esquemas'
import { useEscritura } from '../use-escritura'
import {
  editarComprobante, registrarAjuste, registrarCompra, registrarMerma, registrarVenta, type Comprobante, type DatosAjuste,
  type DatosCompra, type DatosEditarComprobante, type DatosMerma, type DatosVenta, type Naturaleza, type ResultadoEscritura,
} from '@/api/comprobantes'
import { CLAVES } from '@/api/claves'
import { useEstablecimientos } from '@/api/establecimientos'
import { textoProducto, useProductos } from '@/api/productos'
import { RAIZ_MODULO } from '@/app/paginas'
import { Aviso } from '@/componentes/comunes/aviso'
import { Campo } from '@/componentes/comunes/campo'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { CampoFecha } from '@/componentes/comunes/campo-fecha'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { DialogoStockNegativo } from '@/componentes/comunes/dialogo-stock-negativo'
import { SelectorTercero } from '@/componentes/comunes/selector-tercero'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Kbd } from '@/componentes/ui/kbd'
import { Spinner } from '@/componentes/ui/spinner'
import { Textarea } from '@/componentes/ui/textarea'
import { formatearToneladas } from '@/lib/formato'
import { tieneAlgunRol } from '@/lib/roles'
import { useSesion } from '@/lib/sesion'

type Cuerpo = DatosCompra | DatosVenta | DatosMerma | DatosAjuste | DatosEditarComprobante

type Props = {
  naturaleza: Naturaleza
  /** Fecha y establecimiento iniciales de un comprobante nuevo. */
  fechaInicial: string
  establecimientoInicial: string
  /** Para editar un comprobante registrado (PATCH con solo lo que cambió). */
  comprobante?: Comprobante
  /** Al terminar de editar (o cancelar la edición). */
  alTerminarEdicion?: () => void
}

function mensajeExito(comprobante: Comprobante, edicion: boolean): string {
  return `${nombreOperacion(comprobante)} ${documentoComprobante(comprobante)} ${participio(comprobante, edicion ? 'actualizad' : 'registrad')} · kardex recalculado`
}

export function FormularioComprobante({ naturaleza, fechaInicial, establecimientoInicial, comprobante, alTerminarEdicion }: Props) {
  const id = useId()
  const navegar = useNavigate()
  const clienteConsultas = useQueryClient()
  const { usuario } = useSesion()
  const establecimientos = useEstablecimientos()
  const productos = useProductos()
  const edicion = !!comprobante
  const [inicial] = useState<FormularioComprobante>(() =>
    comprobante ? valoresDesdeComprobante(comprobante) : valoresNuevos(naturaleza, fechaInicial, establecimientoInicial))
  const [errorEncabezado, setErrorEncabezado] = useState<string | null>(null)
  const [soloLectura, setSoloLectura] = useState(false)
  const guardarYNueva = useRef(false)
  const botonGuardar = useRef<HTMLButtonElement>(null)
  // Avisos del encabezado: reciben el foco cuando el error no se puede marcar en un campo (docs/UI-UX.md §6).
  const encabezado = useRef<HTMLDivElement>(null)
  const enfocarEncabezado = () => setTimeout(() => encabezado.current?.focus(), 0)

  const {
    register, control, handleSubmit, setError, setValue, setFocus, reset, getValues, clearErrors,
    formState: { errors },
  } = useForm<FormularioComprobante>({ resolver: zodResolver(esquemaComprobante(naturaleza)), defaultValues: inicial })
  const lineas = useFieldArray({ control, name: 'lineas' })
  const [moneda, fecha, establecimientoId, tipoComprobante, tipoOperacion, anioInforme, valoresLineas] = useWatch({
    control,
    name: ['moneda', 'fecha', 'establecimientoId', 'tipoComprobante', 'tipoOperacion', 'anioInforme', 'lineas'],
  })

  const nombreProducto = (idProducto: number) => {
    const producto = productos.data?.find((p) => p.id === idProducto)
    return producto ? textoProducto(producto) : null
  }

  const aplicarUbicacion = (ubicacion: Exclude<UbicacionError, { tipo: 'confirmar' | 'reintentar' }>) => {
    ubicacion.campos.forEach(({ campo, mensaje }, i) => setError(campo, { type: 'api', message: mensaje }, { shouldFocus: i === 0 }))
    setErrorEncabezado(ubicacion.mensaje)
    if (ubicacion.campos.length === 0) enfocarEncabezado()
    if (ubicacion.soloLectura) {
      setSoloLectura(true)
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.comprobantes })
    }
  }

  const ejecutar = (cuerpo: Cuerpo): Promise<ResultadoEscritura> => {
    if (comprobante) return editarComprobante(comprobante.id, cuerpo as DatosEditarComprobante)
    if (naturaleza === 'COMPRA') return registrarCompra(cuerpo as DatosCompra)
    if (naturaleza === 'VENTA') return registrarVenta(cuerpo as DatosVenta)
    if (naturaleza === 'MERMA') return registrarMerma(cuerpo as DatosMerma)
    return registrarAjuste(cuerpo as DatosAjuste)
  }

  const escritura = useEscritura<Cuerpo>({
    ejecutar,
    alExito: (resultado) => {
      const guardado = resultado.comprobante
      toast.success(mensajeExito(guardado, edicion), {
        action: { label: 'Ver kardex', onClick: () => void navegar(`${RAIZ_MODULO}/kardex`) },
      })
      if (edicion) {
        alTerminarEdicion?.()
        return
      }
      if (guardarYNueva.current) {
        const { fecha: fechaActual, establecimientoId: establecimientoActual } = getValues()
        reset(valoresNuevos(naturaleza, fechaActual, establecimientoActual))
        setErrorEncabezado(null)
        setTimeout(() => setFocus(naturaleza === 'COMPRA' || naturaleza === 'VENTA' ? 'serie' : 'lineas.0.productoId'), 0)
        return
      }
      void navegar(`${RAIZ_MODULO}/comprobantes/${encodeURIComponent(guardado.id)}`)
    },
    alError: (error) => {
      const ubicacion = ubicarErrorOperacion(error, {
        naturaleza,
        valores: getValues(),
        nombreProducto,
        edicion,
        soloAsistente: !tieneAlgunRol('inventario', ['ADMIN', 'CONTADOR'], usuario?.roles ?? []),
      })
      if (ubicacion.tipo === 'formulario') aplicarUbicacion(ubicacion)
    },
  })

  const enviar = handleSubmit((valores) => {
    setErrorEncabezado(null)
    if (comprobante) {
      const cambios = aEditar(naturaleza, valores, inicial)
      if (Object.keys(cambios).length === 0) {
        toast.info('No hay cambios que guardar.')
        alTerminarEdicion?.()
        return
      }
      escritura.enviar(cambios)
      return
    }
    escritura.enviar(naturaleza === 'COMPRA' ? aCompra(valores) : naturaleza === 'VENTA' ? aVenta(valores) : naturaleza === 'MERMA' ? aMerma(valores) : aAjuste(valores))
  })

  const agregarLinea = () => {
    lineas.append(lineaVacia(naturaleza === 'COMPRA' || naturaleza === 'AJUSTE' ? 'ENTRADA' : 'SALIDA'), {
      focusName: `lineas.${lineas.fields.length}.productoId`,
    })
  }

  const quitarLinea = (indice: number) => {
    const quedan = lineas.fields.length - 1
    lineas.remove(indice)
    // El botón "Quitar" desaparece: el foco pasa al producto de la línea que ocupa su lugar (o la anterior).
    setTimeout(() => setFocus(`lineas.${Math.min(indice, quedan - 1)}.productoId`), 0)
  }

  const { hayConflicto } = escritura
  useEffect(() => {
    if (hayConflicto) encabezado.current?.focus()
  }, [hayConflicto])

  const vista = totales(naturaleza, valoresLineas ?? [])
  const monedaImporte = naturaleza === 'VENTA' ? moneda : 'PEN'
  const opcionesEstablecimiento = (establecimientos.data ?? [])
    .filter((e) => e.activo || String(e.id) === establecimientoId)
    .map((e) => ({ valor: String(e.id), texto: e.textoLibro || `${e.codigo}-${e.nombre}` }))
  const conTercero = naturaleza === 'COMPRA' || naturaleza === 'VENTA'
  const enviando = escritura.enviando
  // "Guardar" no se deshabilita con `disabled` (el foco caería en <body> al confirmar el stock negativo o al quedar
  // en solo lectura): se marca aria-disabled y se ignora el clic.
  const bloqueado = enviando || soloLectura

  return (
    <form
      noValidate
      onSubmit={(evento) => void enviar(evento)}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
          evento.preventDefault()
          if (!bloqueado) botonGuardar.current?.click()
        } else if (evento.altKey && (evento.key === 'n' || evento.key === 'N') && !soloLectura) {
          evento.preventDefault()
          agregarLinea()
        }
      }}
      className="flex flex-col gap-5"
      aria-describedby={errorEncabezado ? `${id}-error-encabezado` : undefined}
    >
      <div id={`${id}-error-encabezado`} ref={encabezado} tabIndex={-1}
        className="flex flex-col gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {errorEncabezado && <Aviso tono="error" titulo={errorEncabezado} />}
        {escritura.hayConflicto && (
          <Aviso
            tono="error"
            titulo="Otro usuario modificó este kardex al mismo tiempo; vuelve a intentarlo."
            acciones={(
              <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={escritura.reintentar}>
                <RotateCwIcon aria-hidden="true" />
                Reintentar
              </Button>
            )}
          >
            No se guardó nada. Reintentar envía lo mismo otra vez.
          </Aviso>
        )}
      </div>

      <fieldset disabled={soloLectura} className="flex flex-col gap-5">
        <legend className="sr-only">Datos del comprobante</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {conTercero && (
            <Controller
              control={control}
              name="tercero"
              render={({ field }) => (
                <Campo id={`${id}-tercero`} etiqueta={naturaleza === 'COMPRA' ? 'Proveedor' : 'Cliente'} error={errors.tercero?.message}
                  className="sm:col-span-2" ayuda={naturaleza === 'VENTA' ? 'Boleta sin identificar: «CLIENTES VARIOS».' : undefined}>
                  {(a) => (
                    <SelectorTercero {...a} ref={field.ref} valor={field.value} rol={naturaleza === 'COMPRA' ? 'PROVEEDOR' : 'CLIENTE'}
                      deshabilitado={soloLectura}
                      alCambiar={(tercero) => {
                        field.onChange(tercero)
                        clearErrors('tercero')
                      }} />
                  )}
                </Campo>
              )}
            />
          )}

          {naturaleza === 'COMPRA' && (
            <Campo id={`${id}-tipo`} etiqueta="Comprobante">
              {(a) => <Input {...a} readOnly value="01 · Factura" className="h-9 read-only:bg-muted" />}
            </Campo>
          )}

          {naturaleza === 'VENTA' && (
            <>
              <Campo id={`${id}-tipo`} etiqueta="Comprobante" error={errors.tipoComprobante?.message}>
                {(a) => (
                  <CampoSelect {...a} opciones={[{ valor: '01', texto: '01 · Factura' }, { valor: '03', texto: '03 · Boleta' }]}
                    {...register('tipoComprobante', {
                      onChange: (evento: { target: { value: string } }) => {
                        if (evento.target.value === '03') setValue('tipoOperacion', '01')
                      },
                    })} />
                )}
              </Campo>
              <Campo id={`${id}-operacion`} etiqueta="Operación" error={errors.tipoOperacion?.message}
                ayuda={tipoComprobante === '03' ? 'La exportación requiere factura.' : undefined}>
                {(a) => (
                  <CampoSelect {...a} opciones={[
                    { valor: '01', texto: '01 · Venta nacional' },
                    { valor: '17', texto: '17 · Exportación', deshabilitada: tipoComprobante === '03' },
                  ]} {...register('tipoOperacion')} />
                )}
              </Campo>
            </>
          )}

          {naturaleza === 'MERMA' && (
            <Campo id={`${id}-operacion`} etiqueta="Tipo" error={errors.tipoOperacion?.message}
              ayuda={edicion ? 'El tipo no cambia al editar.' : undefined}>
              {(a) => (
                <CampoSelect {...a} disabled={edicion} opciones={[{ valor: '13', texto: '13 · Merma' }, { valor: '14', texto: '14 · Desmedro' }]}
                  {...register('tipoOperacion')} />
              )}
            </Campo>
          )}

          {conTercero && (
            <>
              <Campo id={`${id}-serie`} etiqueta="Serie" error={errors.serie?.message}>
                {(a) => <Input {...a} autoComplete="off" maxLength={4} className="h-9 font-mono uppercase" {...register('serie')} />}
              </Campo>
              <Campo id={`${id}-numero`} etiqueta="Número" error={errors.numero?.message}>
                {(a) => <Input {...a} inputMode="numeric" autoComplete="off" maxLength={8} className="h-9 font-mono" {...register('numero')} />}
              </Campo>
            </>
          )}

          <Campo id={`${id}-fecha`} etiqueta="Fecha de emisión" error={errors.fecha?.message}>
            {(a) => <CampoFecha {...a} {...register('fecha')} />}
          </Campo>

          <Campo id={`${id}-establecimiento`} etiqueta="Establecimiento" error={errors.establecimientoId?.message}
            ayuda={edicion ? 'El establecimiento no cambia al editar.' : undefined}>
            {(a) => <CampoSelect {...a} disabled={edicion} vacio="Elige el establecimiento" opciones={opcionesEstablecimiento} {...register('establecimientoId')} />}
          </Campo>

          {naturaleza === 'VENTA' && (
            <>
              <Campo id={`${id}-moneda`} etiqueta="Moneda" error={errors.moneda?.message}>
                {(a) => <CampoSelect {...a} opciones={[{ valor: 'PEN', texto: 'PEN · Soles' }, { valor: 'USD', texto: 'USD · Dólares' }]} {...register('moneda')} />}
              </Campo>
              {moneda === 'USD' && (
                <Controller
                  control={control}
                  name="tipoCambio"
                  render={({ field }) => (
                    <Campo id={`${id}-tipo-cambio`} etiqueta="Tipo de cambio" error={errors.tipoCambio?.message}
                      ayuda="De la fecha de emisión (3 decimales).">
                      {(a) => <CampoDecimal {...a} ref={field.ref} name={field.name} decimales={3} valor={field.value} alCambiar={field.onChange} onBlur={field.onBlur} className="h-9" />}
                    </Campo>
                  )}
                />
              )}
            </>
          )}

          {naturaleza === 'MERMA' && tipoOperacion === '13' && (
            <Campo id={`${id}-anio-informe`} etiqueta="Año del informe técnico" error={errors.anioInforme?.message}
              ayuda={`Documento: 00-IT-${/^\d{4}$/.test(anioInforme) ? anioInforme : 'AAAA'}`}>
              {(a) => <Input {...a} inputMode="numeric" maxLength={4} autoComplete="off" className="h-9 font-mono" {...register('anioInforme')} />}
            </Campo>
          )}
          {naturaleza === 'MERMA' && tipoOperacion === '14' && (
            <p className="self-end text-sm text-muted-foreground">El documento lo asigna la API (00-AD-…, correlativo del año).</p>
          )}
          {naturaleza === 'AJUSTE' && (
            <p className="self-end text-sm text-muted-foreground">Operación 28. El documento interno lo asigna la API (00-AI-…, correlativo del año).</p>
          )}
        </div>

        {(naturaleza === 'MERMA' || naturaleza === 'AJUSTE') && (
          <Campo id={`${id}-sustento`} etiqueta="Sustento" error={errors.sustento?.message}
            ayuda={naturaleza === 'AJUSTE'
              ? 'Acta de toma de inventario.'
              : tipoOperacion === '14'
                ? 'Acta de destrucción ante notario o juez de paz y comunicación previa a SUNAT.'
                : 'Informe técnico: profesional, colegiatura y fecha. Un mismo informe sirve para varias fechas del año.'}>
            {(a) => <Textarea {...a} rows={2} maxLength={500} {...register('sustento')} />}
          </Campo>
        )}
        {naturaleza === 'MERMA' && (
          <p className="text-sm text-muted-foreground">Se valoriza al costo promedio vigente y va en un asiento aparte del costo de ventas.</p>
        )}

        {conTercero && (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Referencias (guía, ticket de balanza, placa, observación)</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Campo id={`${id}-guia`} etiqueta="Guía de remisión" error={errors.guiaRemision?.message}>
                {(a) => <Input {...a} autoComplete="off" className="h-9 font-mono" {...register('guiaRemision')} />}
              </Campo>
              <Campo id={`${id}-ticket`} etiqueta="Ticket de balanza" error={errors.ticketBalanza?.message}>
                {(a) => <Input {...a} autoComplete="off" className="h-9 font-mono" {...register('ticketBalanza')} />}
              </Campo>
              <Campo id={`${id}-placa`} etiqueta="Placa del vehículo" error={errors.placaVehiculo?.message}>
                {(a) => <Input {...a} autoComplete="off" className="h-9 font-mono uppercase" {...register('placaVehiculo')} />}
              </Campo>
              <Campo id={`${id}-observacion`} etiqueta="Observación" error={errors.observacion?.message}>
                {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('observacion')} />}
              </Campo>
            </div>
          </details>
        )}

        <LineasComprobante
          idBase={id}
          naturaleza={naturaleza}
          control={control}
          register={register}
          errors={errors}
          lineas={lineas}
          moneda={moneda}
          fecha={fecha}
          establecimientoId={establecimientoId}
          simular={naturaleza === 'VENTA' && !edicion}
          alAgregar={agregarLinea}
          alQuitar={quitarLinea}
        />
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm tabular-nums">
          <span className="font-medium">Total {formatearToneladas(vista.toneladas)} TN</span>
          {vista.importe !== null && <> · {formatearImporte(vista.importe, monedaImporte)}</>}
          <span className="text-muted-foreground"> (vista previa; el valor oficial lo calcula la API)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {edicion && (
            <Button type="button" variant="outline" disabled={enviando} onClick={alTerminarEdicion}>Cancelar</Button>
          )}
          {!edicion && (
            <Button type="submit" variant="outline" disabled={enviando || soloLectura}
              onClick={() => { guardarYNueva.current = true }}>Guardar y nueva</Button>
          )}
          <Button ref={botonGuardar} type="submit" aria-disabled={bloqueado} aria-keyshortcuts="Control+Enter"
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={(evento) => {
              if (bloqueado) {
                evento.preventDefault()
                return
              }
              guardarYNueva.current = false
            }}>
            {enviando && <Spinner aria-hidden="true" />}
            {enviando ? 'Guardando…' : 'Guardar'}
            {!enviando && <Kbd aria-hidden="true" className="ml-1 bg-primary-foreground/20 text-primary-foreground">Ctrl+↵</Kbd>}
          </Button>
        </div>
      </div>

      <DialogoStockNegativo
        abierto={escritura.confirmacion !== null}
        alCambiarAbierto={(abierto) => { if (!abierto) escritura.cancelarConfirmacion() }}
        detalle={escritura.confirmacion}
        producto={escritura.confirmacion?.productoId ? nombreProducto(escritura.confirmacion.productoId) : null}
        alConfirmar={escritura.confirmar}
        focoAlCerrar={botonGuardar}
      />
    </form>
  )
}
