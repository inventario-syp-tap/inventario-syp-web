// Registrar impresión del libro 12.1 (A, C; solo meses CERRADOS; POST /libros/12-1/impresiones). Pide solo la
// observación (opcional): la fecha de hoy se muestra como informativa y la oficial es `impresoEn`, que pone el
// servidor (RegistrarImpresionDto no recibe fecha). Luego se invalidan periodos y el libro 12.1.
import { useId, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { invalidarTrasEscritura } from '@/api/claves'
import { useRegistrarImpresion121 } from '@/api/libros'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { Campo } from '@/componentes/comunes/campo'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { MAXIMO_MOTIVO } from '@/componentes/comunes/dialogo-confirmacion'
import { Textarea } from '@/componentes/ui/textarea'
import { codigoDeError, esConflicto, mensajeDeError } from '@/lib/errores'
import { formatearFecha, formatearPeriodo, hoyIso } from '@/lib/formato'

const esquema = z.object({
  observacion: z.string().trim().max(MAXIMO_MOTIVO, `La observación admite hasta ${MAXIMO_MOTIVO} caracteres.`),
})

type Formulario = z.infer<typeof esquema>

type Props = {
  anio: number
  mes: number
  /** El mes ya tenía una impresión: se registra una reimpresión. */
  reimpresion: boolean
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoRegistrarImpresion({ anio, mes, reimpresion, abierto, alCambiarAbierto, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const registrar = useRegistrarImpresion121()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [conflicto, setConflicto] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { observacion: '' },
  })
  const periodo = formatearPeriodo(anio, mes)

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={`Registrar impresión · ${periodo}`}
      descripcion={`Confirma que imprimiste el libro 12.1 de ${periodo} en las hojas legalizadas${reimpresion ? ' (reimpresión)' : ''}.`}
      textoGuardar="Registrar impresión"
      alEnviar={handleSubmit((valores) => {
        setErrorEnvio(null)
        setConflicto(false)
        const observacion = valores.observacion.trim()
        registrar.mutate({ anio, mes, ...(observacion ? { observacion } : {}) }, {
          onSuccess: () => {
            toast.success(`Impresión del libro 12.1 de ${periodo} registrada`)
            alCambiarAbierto(false)
          },
          onError: (error) => {
            if (esConflicto(error)) {
              setConflicto(true)
              return
            }
            setErrorEnvio(codigoDeError(error) === 'PERIODO_NO_CERRADO'
              ? `${periodo} no está cerrado: el libro 12.1 se registra como impreso después de cerrar el mes.`
              : mensajeDeError(error))
          },
        })
      })}
      enviando={registrar.isPending}
      errorEnvio={errorEnvio}
      focoAlCerrar={focoAlCerrar}
    >
      <p className="text-sm">
        Fecha: <span className="tabular-nums">{formatearFecha(hoyIso())}</span>{' '}
        <span className="text-muted-foreground">(hoy; la fecha oficial la registra el sistema al guardar)</span>
      </p>
      <Campo id={`${id}-observacion`} etiqueta="Observación (opcional)" error={errors.observacion?.message}
        ayuda="Por ejemplo, las hojas legalizadas usadas.">
        {(a) => <Textarea {...a} rows={3} maxLength={MAXIMO_MOTIVO} {...register('observacion')} />}
      </Campo>
      {conflicto && (
        <AvisoConflicto alReintentar={() => {
          setConflicto(false)
          invalidarTrasEscritura(clienteConsultas)
        }} />
      )}
    </DialogoFormulario>
  )
}
