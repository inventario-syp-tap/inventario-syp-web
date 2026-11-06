// Una pestaña de Configuración: formulario con su "Guardar" o, sin permiso, en solo lectura (fieldset disabled
// y sin botón) con el aviso de quién la edita. El guardado manda un PATCH solo con esa sección.
import type { FormEventHandler, ReactNode } from 'react'
import { LockIcon } from 'lucide-react'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Button } from '@/componentes/ui/button'
import { Spinner } from '@/componentes/ui/spinner'
import { mensajeDeError } from '@/lib/errores'

type Props = {
  titulo: string
  descripcion?: ReactNode
  editable: boolean
  /** Quién puede editarla, para el aviso de solo lectura. */
  quienEdita: string
  alEnviar: FormEventHandler<HTMLFormElement>
  enviando: boolean
  error: unknown
  children: ReactNode
}

export function FormularioSeccion({ titulo, descripcion, editable, quienEdita, alEnviar, enviando, error, children }: Props) {
  return (
    <form
      noValidate
      onSubmit={alEnviar}
      onKeyDown={(evento) => {
        if (editable && evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
          evento.preventDefault()
          if (!enviando) evento.currentTarget.requestSubmit()
        }
      }}
      className="flex flex-col gap-4 rounded-md border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {!editable && (
        <p className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
          <LockIcon aria-hidden="true" className="size-4 shrink-0" />
          Solo lectura: esta sección la edita {quienEdita}.
        </p>
      )}
      <fieldset disabled={!editable} className="flex flex-col gap-4">
        <legend className="sr-only">{titulo}</legend>
        {children}
      </fieldset>
      {error ? <EstadoError mensaje={mensajeDeError(error)} /> : null}
      {editable && (
        <div className="flex justify-end">
          <Button type="submit" disabled={enviando}>
            {enviando && <Spinner aria-hidden="true" />}
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      )}
    </form>
  )
}
