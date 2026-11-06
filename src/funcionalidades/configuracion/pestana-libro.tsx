// Pestaña Libro 12.1 (docs/UI-UX.md §5.17, ADMIN y CONTADOR): modo por defecto y por año, decimales, márgenes,
// reserva del sello del notario y recordatorio de impresión. Sin folio: las hojas legalizadas ya vienen numeradas.
import { useEffect, useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cambiosLibro, esquemaLibro, valoresLibro, type FormularioLibro } from './esquemas'
import { FormularioSeccion } from './formulario-seccion'
import { useGuardarSeccion } from './use-guardar-seccion'
import { useCatalogos } from '@/api/catalogos'
import { CLAVES } from '@/api/claves'
import { fijarLibroModo, useLibroModo, type Configuracion, type ModoLibro } from '@/api/configuracion'
import { Campo } from '@/componentes/comunes/campo'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Spinner } from '@/componentes/ui/spinner'
import { mensajeDeError } from '@/lib/errores'

const MODOS = [
  { valor: 'AGRUPADO', texto: 'Agrupado (un renglón por comprobante)' },
  { valor: 'DETALLADO', texto: 'Detallado (un renglón por línea)' },
]

type CampoEntero = keyof Pick<FormularioLibro,
  'decimalesCantidad' | 'decimalesSaldo' | 'decimalesTotales' | 'margenSuperior' | 'margenInferior' | 'margenIzquierdo' |
  'margenDerecho' | 'selloAncho' | 'selloAlto' | 'recordarImpresionMesesDespues' | 'plazoLegalAtrasoMeses'>

/** Modo del libro de un año: AGRUPADO o DETALLADO (PUT /configuracion/libro-modo/:anio). */
function ModoPorAnio({ editable }: { editable: boolean }) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [anioActual] = useState(() => new Date().getFullYear())
  const [anio, setAnio] = useState(anioActual)
  // Lo elegido vale solo para su año; si no, se muestra el modo que tiene ese año en la API.
  const [elegido, setElegido] = useState<{ anio: number; modo: ModoLibro } | null>(null)
  const consulta = useLibroModo(anio)
  const modo: ModoLibro | '' = elegido?.anio === anio ? elegido.modo : consulta.data?.modo ?? ''
  const setModo = (nuevo: ModoLibro) => setElegido({ anio, modo: nuevo })

  const fijar = useMutation({
    mutationFn: (nuevo: ModoLibro) => fijarLibroModo(anio, nuevo),
    onSuccess: (resultado) => {
      clienteConsultas.setQueryData([...CLAVES.configuracion, 'libro-modo', anio], resultado)
      toast.success(`Modo del libro 12.1 de ${anio}: ${resultado.modo === 'AGRUPADO' ? 'agrupado' : 'detallado'}`)
    },
  })

  const anios = Array.from({ length: 5 }, (_, i) => anioActual + 1 - i).map((a) => ({ valor: String(a), texto: String(a) }))
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3 rounded-md border bg-card p-4">
      <h2 id={`${id}-titulo`} className="text-base font-semibold">Modo del libro por año</h2>
      <div className="flex flex-wrap items-end gap-3">
        <Campo id={`${id}-anio`} etiqueta="Año" className="w-28">
          {(a) => <CampoSelect {...a} value={String(anio)} onChange={(e) => setAnio(Number.parseInt(e.target.value, 10))} opciones={anios} />}
        </Campo>
        <Campo id={`${id}-modo`} etiqueta="Modo" className="w-80"
          ayuda={consulta.data && (consulta.data.origen === 'ANIO' ? `Fijado para ${anio}.` : 'Sin fijar: usa el modo por defecto.')}>
          {(a) => consulta.isPending
            ? <Skeleton className="h-9 w-full" />
            : <CampoSelect {...a} disabled={!editable} value={modo} onChange={(e) => setModo(e.target.value as ModoLibro)} opciones={MODOS} />}
        </Campo>
        {editable && (
          <Button type="button" variant="secondary" disabled={!modo || fijar.isPending || modo === consulta.data?.modo && consulta.data.origen === 'ANIO'}
            onClick={() => { if (modo) fijar.mutate(modo) }}>
            {fijar.isPending && <Spinner aria-hidden="true" />}
            Fijar modo de {anio}
          </Button>
        )}
      </div>
      {consulta.isError && <EstadoError mensaje={mensajeDeError(consulta.error)} alReintentar={() => void consulta.refetch()} />}
      {fijar.isError && <EstadoError mensaje={mensajeDeError(fijar.error)} />}
    </section>
  )
}

export function PestanaLibro({ configuracion, editable }: { configuracion: Configuracion; editable: boolean }) {
  const id = useId()
  const catalogos = useCatalogos()
  const guardar = useGuardarSeccion('el libro 12.1')
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormularioLibro>({
    resolver: zodResolver(esquemaLibro),
    defaultValues: valoresLibro(configuracion),
  })
  // Tras guardar (esta u otra pestaña) llega la configuración nueva: se conserva lo que se está editando.
  useEffect(() => reset(valoresLibro(configuracion), { keepDirtyValues: true }), [configuracion, reset])

  const entero = (campo: CampoEntero, etiqueta: string, ayuda?: string) => (
    <Campo id={`${id}-${campo}`} etiqueta={etiqueta} error={errors[campo]?.message} ayuda={ayuda}>
      {(a) => <Input {...a} inputMode="numeric" className="h-9 w-24 text-right tabular-nums" {...register(campo)} />}
    </Campo>
  )
  const unidades = (catalogos.data?.unidadesMedida ?? []).map((u) => ({ valor: u.codigo, texto: `${u.codigo} · ${u.descripcion}` }))
  if (!unidades.some((u) => u.valor === configuracion.libro.unidadMedida)) {
    unidades.unshift({ valor: configuracion.libro.unidadMedida, texto: configuracion.libro.unidadMedida })
  }

  return (
    <div className="flex flex-col gap-4">
      <FormularioSeccion
        titulo="Libro 12.1"
        descripcion="Formato del registro del inventario permanente en unidades físicas (PDF de la API)."
        editable={editable}
        quienEdita="el administrador o la contadora"
        alEnviar={handleSubmit((d) => guardar.mutate(cambiosLibro(d)))}
        enviando={guardar.isPending}
        error={guardar.error}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={`${id}-modo`} etiqueta="Modo por defecto" error={errors.modoPorDefecto?.message}>
            {(a) => <CampoSelect {...a} opciones={MODOS} {...register('modoPorDefecto')} />}
          </Campo>
          <Campo id={`${id}-unidad`} etiqueta="Unidad de medida (Tabla 6)" error={errors.unidadMedida?.message}>
            {(a) => <CampoSelect {...a} opciones={unidades} {...register('unidadMedida')} />}
          </Campo>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Decimales</legend>
          <div className="flex flex-wrap gap-4">
            {entero('decimalesCantidad', 'Entradas y salidas', 'De 0 a 4.')}
            {entero('decimalesSaldo', 'Saldo final', 'De 0 a 6.')}
            {entero('decimalesTotales', 'Totales', 'De 0 a 6.')}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Impresión (A4)</legend>
          <div className="flex flex-wrap gap-4">
            <Campo id={`${id}-orientacion`} etiqueta="Orientación" className="w-44">
              {(a) => <CampoSelect {...a} opciones={[{ valor: 'HORIZONTAL', texto: 'Horizontal' }, { valor: 'VERTICAL', texto: 'Vertical' }]} {...register('orientacion')} />}
            </Campo>
            {entero('margenSuperior', 'Margen superior (mm)')}
            {entero('margenInferior', 'Margen inferior (mm)')}
            {entero('margenIzquierdo', 'Margen izquierdo (mm)')}
            {entero('margenDerecho', 'Margen derecho (mm)')}
          </div>
          <div className="flex flex-wrap gap-4">
            {entero('selloAncho', 'Sello: ancho (mm)', 'Zona libre para el sello del notario.')}
            {entero('selloAlto', 'Sello: alto (mm)')}
            {entero('recordarImpresionMesesDespues', 'Recordar imprimir (meses después)', 'De 0 a 12.')}
            {entero('plazoLegalAtrasoMeses', 'Plazo legal de atraso (meses)', 'De 0 a 12.')}
          </div>
          <Controller control={control} name="imprimirFolio" render={({ field }) => (
            <CampoCasilla id={`${id}-folio`} etiqueta="Imprimir número de folio (las hojas legalizadas ya vienen numeradas)"
              ref={field.ref} marcado={field.value} alCambiar={field.onChange} deshabilitado={!editable} />
          )} />
        </fieldset>
      </FormularioSeccion>
      <ModoPorAnio editable={editable} />
    </div>
  )
}
