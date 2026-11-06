// Confirmación antes de una acción con efecto (docs/UI-UX.md §4): repite qué va a pasar y, si se pide, un motivo
// opcional u obligatorio (anular, reabrir…). Se abre controlado (sin AlertDialogTrigger), así que Radix no sabe a
// dónde devolver el foco: lo indica `focoAlCerrar` (normalmente el botón que lo abrió, docs/UI-UX.md §7).
import { useId, useState, type ReactNode, type RefObject } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/componentes/ui/alert-dialog'
import { Field, FieldError, FieldLabel } from '@/componentes/ui/field'
import { Textarea } from '@/componentes/ui/textarea'

export const MAXIMO_MOTIVO = 500

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  titulo: string
  descripcion: ReactNode
  textoConfirmar: string
  /** Recibe el motivo escrito (cadena vacía si no se pidió o se dejó en blanco). */
  alConfirmar: (motivo: string) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
  /** Pide un motivo: opcional u obligatorio. Sin esta prop no hay campo. */
  motivo?: 'opcional' | 'obligatorio'
  /** Acción destructiva (anular, desactivar): botón en rojo. */
  destructiva?: boolean
}

export function DialogoConfirmacion({
  abierto, alCambiarAbierto, titulo, descripcion, textoConfirmar, alConfirmar, focoAlCerrar, motivo, destructiva,
}: Props) {
  const idMotivo = useId()
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cambiarAbierto = (siguiente: boolean) => {
    if (!siguiente) {
      setTexto('')
      setError(null)
    }
    alCambiarAbierto(siguiente)
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarAbierto}>
      <AlertDialogContent
        onCloseAutoFocus={(evento) => {
          if (!focoAlCerrar?.current) return
          evento.preventDefault()
          focoAlCerrar.current.focus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        {motivo && (
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor={idMotivo}>Motivo{motivo === 'opcional' ? ' (opcional)' : ''}</FieldLabel>
            <Textarea
              id={idMotivo}
              value={texto}
              maxLength={MAXIMO_MOTIVO}
              rows={3}
              aria-invalid={!!error}
              aria-describedby={error ? `${idMotivo}-error` : undefined}
              onChange={(evento) => {
                setTexto(evento.target.value)
                if (error) setError(null)
              }}
            />
            <FieldError id={`${idMotivo}-error`} errors={error ? [{ message: error }] : []} />
          </Field>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={destructiva ? 'destructive' : 'default'}
            onClick={(evento) => {
              const limpio = texto.trim()
              if (motivo === 'obligatorio' && !limpio) {
                evento.preventDefault()
                setError('Escribe el motivo.')
                return
              }
              alConfirmar(limpio)
              setTexto('')
            }}
          >
            {textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
