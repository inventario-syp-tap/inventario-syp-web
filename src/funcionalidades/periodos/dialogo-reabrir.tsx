// Reabrir el último mes cerrado (docs/UI-UX.md §5.9): motivo obligatorio (zod, mismo límite que la API). Las
// advertencias que devuelve la API (p. ej. el libro 12.1 ya impreso) se muestran al terminar.
import { useId, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { esquemaReabrir, type FormularioReabrir } from './esquemas'
import { invalidarTrasEscritura } from '@/api/claves'
import { reabrirPeriodo } from '@/api/periodos'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { Campo } from '@/componentes/comunes/campo'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { MAXIMO_MOTIVO } from '@/componentes/comunes/dialogo-confirmacion'
import { Textarea } from '@/componentes/ui/textarea'
import { esConflicto, mensajeDeError } from '@/lib/errores'
import { formatearPeriodo } from '@/lib/formato'

type Props = {
  anio: number
  mes: number
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoReabrir({ anio, mes, abierto, alCambiarAbierto, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const nombre = formatearPeriodo(anio, mes)
  const { register, handleSubmit, formState: { errors } } = useForm<FormularioReabrir>({
    resolver: zodResolver(esquemaReabrir),
    defaultValues: { motivo: '' },
  })
  const reabrir = useMutation({
    mutationFn: (motivo: string) => reabrirPeriodo(anio, mes, motivo),
    onSuccess: (resultado) => {
      invalidarTrasEscritura(clienteConsultas)
      alCambiarAbierto(false)
      toast.success(`${nombre} reabierto`, {
        description: resultado.advertencias.length > 0 ? resultado.advertencias.join(' ') : undefined,
        duration: resultado.advertencias.length > 0 ? Infinity : undefined,
      })
    },
  })
  const conflicto = reabrir.isError && esConflicto(reabrir.error)

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={`Reabrir ${nombre}`}
      descripcion={`Se podrá volver a registrar y modificar en ${nombre}. Al cerrarlo de nuevo, el sistema compara los totales con el cierre anterior.`}
      alEnviar={handleSubmit((valores) => reabrir.mutate(valores.motivo))}
      enviando={reabrir.isPending}
      errorEnvio={reabrir.isError && !conflicto ? mensajeDeError(reabrir.error) : null}
      textoGuardar="Reabrir"
      focoAlCerrar={focoAlCerrar}
    >
      <Campo id={`${id}-motivo`} etiqueta="Motivo" error={errors.motivo?.message}
        ayuda="Queda en la auditoría (p. ej. «Corrección de una factura de compra»).">
        {(a) => <Textarea {...a} rows={3} maxLength={MAXIMO_MOTIVO} {...register('motivo')} />}
      </Campo>
      {conflicto && (
        <AvisoConflicto alReintentar={() => {
          reabrir.reset()
          invalidarTrasEscritura(clienteConsultas)
        }} />
      )}
    </DialogoFormulario>
  )
}
