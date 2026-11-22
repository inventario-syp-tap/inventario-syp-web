// Nueva toma de inventario (A, C; docs/UI-UX.md §5.15), pasos 1 y 2 del asistente: (1) fecha y responsable;
// (2) cantidad contada (pesada) por producto activo. Al confirmar se registra la toma (POST /tomas-inventario) y la
// API calcula el saldo del sistema a esa fecha y la diferencia; los pasos 3 (diferencias) y 4 (acciones y cierre)
// siguen en el detalle de la toma. Mes cerrado: aviso en la fecha y no deja avanzar (la API igual responde 409).
import { useEffect, useId, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { Pasos, TituloPaso } from './componentes-toma'
import { esquemaNuevaToma, MAXIMO_RESPONSABLE, MAXIMO_TEXTO, type FormularioNuevaToma } from './esquemas'
import { CLAVES } from '@/api/claves'
import { useEstadoMes } from '@/api/periodos'
import { textoProducto, useProductos, type Producto } from '@/api/productos'
import { crearToma, type DatosCrearToma, type Toma } from '@/api/tomas-inventario'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Campo } from '@/componentes/comunes/campo'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { CampoFecha } from '@/componentes/comunes/campo-fecha'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Spinner } from '@/componentes/ui/spinner'
import { Textarea } from '@/componentes/ui/textarea'
import { camposConError, codigoDeError, mensajeDeError } from '@/lib/errores'
import { formatearPeriodo, hoyIso } from '@/lib/formato'
import { aplicarErrorDeApi, vacioANulo } from '@/lib/formularios'

const RUTA = `${RAIZ_MODULO}/toma-inventario`

function FormularioNuevaToma({ productos }: { productos: readonly Producto[] }) {
  const id = useId()
  const navegar = useNavigate()
  const clienteConsultas = useQueryClient()
  const [paso, setPaso] = useState<1 | 2>(1)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const refTitulo = useRef<HTMLHeadingElement>(null)
  const pasoAnterior = useRef(paso)
  // Tras un 409 PERIODO_CERRADO se vuelve al paso 1 y el foco va a la Fecha (no al título).
  const enfocarFecha = useRef(false)
  const { control, register, handleSubmit, trigger, setError, setFocus, formState: { errors } } = useForm<FormularioNuevaToma>({
    resolver: zodResolver(esquemaNuevaToma),
    defaultValues: {
      fecha: hoyIso(),
      responsable: '',
      observacion: '',
      lineas: productos.map((p) => ({ productoId: p.id, cantidadContada: '' })),
    },
  })
  const { fields } = useFieldArray({ control, name: 'lineas' })
  const fecha = useWatch({ control, name: 'fecha' })
  const estadoMes = useEstadoMes(fecha)
  const mesCerrado = estadoMes?.estado === 'CERRADO'

  // Al cambiar de paso, el foco va a su título (el lector de pantalla anuncia "Paso 2 de 4…").
  useEffect(() => {
    if (pasoAnterior.current === paso) return
    pasoAnterior.current = paso
    if (paso === 1 && enfocarFecha.current) {
      enfocarFecha.current = false
      setFocus('fecha')
      return
    }
    refTitulo.current?.focus()
  }, [paso, setFocus])

  const registrar = useMutation({
    mutationFn: (datos: DatosCrearToma) => crearToma(datos),
    onSuccess: (toma: Toma) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.tomas })
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.dashboard })
      toast.success('Toma registrada · revisa las diferencias con el sistema')
      void navegar(`${RUTA}/${toma.id}`)
    },
    onError: (error) => {
      if (codigoDeError(error) === 'PERIODO_CERRADO') {
        enfocarFecha.current = true
        setPaso(1)
        setErrorEnvio(null)
        setError('fecha', { type: 'api', message: mensajeDeError(error) })
        return
      }
      // Un 400 VALIDACION de un campo del paso 1: se vuelve a ese paso para mostrarlo junto a su campo.
      const campos = Object.keys(camposConError(error))
      if (campos.some((c) => c === 'fecha' || c === 'responsable' || c === 'observacion')) setPaso(1)
      setErrorEnvio(aplicarErrorDeApi(error, setError, ['fecha', 'responsable', 'observacion']))
    },
  })

  const siguiente = async () => {
    if (mesCerrado) {
      setFocus('fecha')
      return
    }
    if (await trigger(['fecha', 'responsable', 'observacion'], { shouldFocus: true })) setPaso(2)
  }

  const enviar = handleSubmit((valores) => {
    setErrorEnvio(null)
    const observacion = vacioANulo(valores.observacion)
    registrar.mutate({
      fecha: valores.fecha,
      responsable: valores.responsable.trim(),
      ...(observacion ? { observacion } : {}),
      lineas: valores.lineas.map((l) => ({ productoId: l.productoId, cantidadContada: l.cantidadContada.trim() })),
    })
  }, (errores) => {
    // Un error del paso 1 (p. ej. la fecha) con el paso 2 a la vista: se vuelve al paso 1.
    if (errores.fecha || errores.responsable || errores.observacion) setPaso(1)
  })

  return (
    <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4"
      onKeyDown={(evento) => {
        // Ctrl+Enter (docs/UI-UX.md §6): en el paso 1 avanza; en el paso 2 calcula las diferencias.
        if (evento.key !== 'Enter' || !(evento.ctrlKey || evento.metaKey)) return
        evento.preventDefault()
        if (paso === 1) void siguiente()
        else if (!registrar.isPending) evento.currentTarget.requestSubmit()
      }}>
      <Pasos actual={paso} />
      {paso === 1 ? (
        <section className="flex max-w-xl flex-col gap-4">
          <TituloPaso numero={1} refTitulo={refTitulo}>Fecha y responsable</TituloPaso>
          <Campo id={`${id}-fecha`} etiqueta="Fecha de la toma" error={errors.fecha?.message ?? (mesCerrado && estadoMes
            ? `${formatearPeriodo(estadoMes.anio, estadoMes.mes)} está cerrado: no se puede registrar una toma en ese mes. Pide reabrirlo en Periodos.`
            : undefined)}
            ayuda="El sistema calcula el saldo del kardex a esta fecha.">
            {(a) => <CampoFecha {...a} {...register('fecha')} className="w-44" aria-invalid={a['aria-invalid'] || mesCerrado} />}
          </Campo>
          <Campo id={`${id}-responsable`} etiqueta="Responsable del conteo" error={errors.responsable?.message}
            ayuda="Solo el nombre o el cargo de quien contó (queda como sustento de la toma).">
            {(a) => <Input {...a} {...register('responsable')} maxLength={MAXIMO_RESPONSABLE} autoComplete="off" />}
          </Campo>
          <Campo id={`${id}-observacion`} etiqueta="Observación (opcional)" error={errors.observacion?.message}>
            {(a) => <Textarea {...a} rows={2} maxLength={MAXIMO_TEXTO} {...register('observacion')} />}
          </Campo>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to={RUTA}>Cancelar</Link></Button>
            <Button type="button" onClick={() => void siguiente()}>
              Siguiente: cantidades
              <ArrowRightIcon aria-hidden="true" />
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <TituloPaso numero={2} refTitulo={refTitulo}>Cantidades contadas</TituloPaso>
          <p className="text-sm text-muted-foreground">
            Escribe lo que se pesó de cada producto en toneladas (0 si no hay). Al continuar, el sistema calcula la diferencia con su saldo.
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[28rem] text-sm">
              <caption className="sr-only">Cantidad contada por producto</caption>
              <thead className="bg-muted">
                <tr className="text-left">
                  <th scope="col" className="px-3 py-2">Producto</th>
                  <th scope="col" className="px-3 py-2 text-right">Cantidad contada (TN)</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((campo, i) => {
                  const producto = productos.find((p) => p.id === campo.productoId)
                  const nombre = producto ? textoProducto(producto) : `Producto ${campo.productoId}`
                  const error = errors.lineas?.[i]?.cantidadContada?.message
                  const idCampo = `${id}-linea-${i}`
                  return (
                    <tr key={campo.id} className="border-t">
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <label htmlFor={idCampo}>{nombre}</label>
                      </th>
                      <td className="px-3 py-2">
                        <Controller control={control} name={`lineas.${i}.cantidadContada`} render={({ field }) => (
                          <div className="flex flex-col items-end gap-1">
                            <CampoDecimal id={idCampo} ref={field.ref} name={field.name} decimales={4} valor={field.value}
                              alCambiar={field.onChange} onBlur={field.onBlur} className="h-9 w-36"
                              aria-invalid={!!error} aria-describedby={error ? `${idCampo}-error` : undefined} />
                            {error && <p id={`${idCampo}-error`} className="text-xs text-destructive">{error}</p>}
                          </div>
                        )} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {errors.lineas?.message && <p className="text-sm text-destructive">{errors.lineas.message}</p>}
          {errorEnvio && <EstadoError mensaje={errorEnvio} />}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={registrar.isPending} onClick={() => setPaso(1)}>
              <ArrowLeftIcon aria-hidden="true" />
              Volver al paso 1
            </Button>
            <Button type="submit" aria-disabled={registrar.isPending || undefined}
              onClick={(e) => { if (registrar.isPending) e.preventDefault() }}>
              {registrar.isPending && <Spinner aria-hidden="true" />}
              {registrar.isPending ? 'Calculando…' : 'Calcular diferencias'}
            </Button>
          </div>
        </section>
      )}
    </form>
  )
}

export function PaginaNuevaToma() {
  useTituloPagina('Nueva toma de inventario')
  const productos = useProductos()
  const activos = (productos.data ?? []).filter((p) => p.activo)

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Nueva toma de inventario"
        descripcion="Registra el conteo físico. Después revisarás las diferencias y decidirás qué hacer con cada una." />
      {productos.isError ? (
        <EstadoError mensaje={mensajeDeError(productos.error)} alReintentar={() => void productos.refetch()} />
      ) : !productos.data ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Cargando los productos…</span>
          <Skeleton className="h-8 w-96 max-w-full" />
          <Skeleton className="h-48 w-full max-w-xl" />
        </div>
      ) : activos.length === 0 ? (
        <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          No hay productos activos para contar.{' '}
          <Link className="underline underline-offset-2" to={`${RAIZ_MODULO}/maestros/productos`}>Ir a Productos</Link>
        </p>
      ) : (
        <FormularioNuevaToma productos={activos} />
      )}
    </div>
  )
}
