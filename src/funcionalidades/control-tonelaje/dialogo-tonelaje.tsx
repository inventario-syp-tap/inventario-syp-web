// Registrar o editar el tonelaje reportado de un mes (A, C; PUT /control-tonelaje/:anio/:mes): toneladas (4
// decimales), fuente ("REPORTE EXTERNO" por defecto; fija al editar un reporte existente, porque la API reemplaza
// el reporte de ESA fuente) y observación. La diferencia con las compras del kardex la calcula la API.
import { useId, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { esquemaTonelaje, MAXIMO_FUENTE, MAXIMO_OBSERVACION, type FormularioTonelaje } from './esquemas'
import { CLAVES } from '@/api/claves'
import { FUENTE_POR_DEFECTO, registrarTonelaje, type DatosRegistrarTonelaje, type ReporteTonelaje } from '@/api/control-tonelaje'
import { Campo } from '@/componentes/comunes/campo'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Input } from '@/componentes/ui/input'
import { Textarea } from '@/componentes/ui/textarea'
import { formatearPeriodo, formatearToneladas } from '@/lib/formato'
import { aplicarErrorDeApi, vacioANulo } from '@/lib/formularios'

type Props = {
  anio: number
  mes: number
  /** Compras del kardex del mes (para tenerlas a la vista al digitar). */
  comprasKardex: string
  /** El reporte que se edita; sin él se registra uno nuevo. */
  reporte?: ReporteTonelaje
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoTonelaje({ anio, mes, comprasKardex, reporte, abierto, alCambiarAbierto, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const editando = !!reporte
  const periodo = formatearPeriodo(anio, mes)
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<FormularioTonelaje>({
    resolver: zodResolver(esquemaTonelaje),
    defaultValues: {
      toneladasReportadas: reporte?.toneladasReportadas ?? '',
      fuente: reporte?.fuente ?? FUENTE_POR_DEFECTO,
      observacion: reporte?.observacion ?? '',
    },
  })

  const guardar = useMutation({
    mutationFn: (datos: DatosRegistrarTonelaje) => registrarTonelaje(anio, mes, datos),
    onSuccess: () => {
      toast.success(`Tonelaje reportado de ${periodo} guardado`)
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.controlTonelaje })
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.dashboard })
      alCambiarAbierto(false)
    },
    onError: (error) => setErrorEnvio(aplicarErrorDeApi(error, setError, ['toneladasReportadas', 'fuente', 'observacion'])),
  })

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={`${editando ? 'Editar' : 'Registrar'} tonelaje reportado · ${periodo}`}
      descripcion={`Compras del kardex en ${periodo}: ${formatearToneladas(comprasKardex)} TN. La diferencia la calcula el sistema al guardar.`}
      alEnviar={handleSubmit((valores) => {
        setErrorEnvio(null)
        const observacion = vacioANulo(valores.observacion)
        guardar.mutate({
          toneladasReportadas: valores.toneladasReportadas.trim(),
          fuente: (reporte?.fuente ?? valores.fuente).trim(),
          ...(observacion ? { observacion } : {}),
        })
      })}
      enviando={guardar.isPending}
      errorEnvio={errorEnvio}
      focoAlCerrar={focoAlCerrar}
    >
      <Controller control={control} name="toneladasReportadas" render={({ field }) => (
        <Campo id={`${id}-tn`} etiqueta="Toneladas reportadas (TN)" error={errors.toneladasReportadas?.message} ayuda="Hasta 4 decimales.">
          {(a) => (
            <CampoDecimal {...a} ref={field.ref} name={field.name} decimales={4} valor={field.value}
              alCambiar={field.onChange} onBlur={field.onBlur} className="h-9 w-40" />
          )}
        </Campo>
      )} />
      <Campo id={`${id}-fuente`} etiqueta="Fuente" error={errors.fuente?.message}
        ayuda={editando ? 'La fuente de un reporte existente no se cambia.' : 'Quién reporta, sin nombres de personas.'}>
        {(a) => <Input {...a} {...register('fuente')} readOnly={editando} maxLength={MAXIMO_FUENTE} className="read-only:bg-muted" />}
      </Campo>
      <Campo id={`${id}-observacion`} etiqueta="Observación (opcional)" error={errors.observacion?.message}
        ayuda="Por ejemplo, el motivo de la diferencia.">
        {(a) => <Textarea {...a} rows={3} maxLength={MAXIMO_OBSERVACION} {...register('observacion')} />}
      </Campo>
    </DialogoFormulario>
  )
}
