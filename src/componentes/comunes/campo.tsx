// Etiqueta + control + ayuda + error, con los atributos de accesibilidad ya conectados (docs/UI-UX.md §7):
// <label for>, aria-invalid y aria-describedby hacia la ayuda y el error.
import type { ReactNode } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/componentes/ui/field'

export type AtributosCampo = {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

type Props = {
  id: string
  etiqueta: ReactNode
  error?: string
  ayuda?: ReactNode
  className?: string
  children: (atributos: AtributosCampo) => ReactNode
}

export function Campo({ id, etiqueta, error, ayuda, className, children }: Props) {
  const descripciones = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': descripciones || undefined })}
      {ayuda && <FieldDescription id={`${id}-ayuda`}>{ayuda}</FieldDescription>}
      <FieldError id={`${id}-error`} errors={error ? [{ message: error }] : []} />
    </Field>
  )
}
