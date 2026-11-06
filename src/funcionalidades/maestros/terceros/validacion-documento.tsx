// Estado de la validación del documento en vivo (use-validacion-documento.ts), anunciado con aria-live.
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { mensajeDocumentoInvalido, type useValidacionDocumento } from './use-validacion-documento'
import { Spinner } from '@/componentes/ui/spinner'

type Props = {
  id: string
  validacion: ReturnType<typeof useValidacionDocumento>
  /** Al editar, el propio tercero no cuenta como duplicado. */
  terceroActualId?: number
}

/** Línea de estado bajo el número de documento. Siempre montada para que aria-live anuncie los cambios. */
export function EstadoValidacionDocumento({ id, validacion, terceroActualId }: Props) {
  const { data, isFetching, isError, listo } = validacion
  let contenido = null
  if (listo && isFetching) {
    contenido = <><Spinner aria-hidden="true" className="size-3.5" /> Validando el documento…</>
  } else if (listo && isError) {
    contenido = <span className="text-muted-foreground">No se pudo validar ahora; la API lo revisará al guardar.</span>
  } else if (listo && data && !data.valido) {
    contenido = (
      <span className="inline-flex items-center gap-1 text-destructive">
        <CircleAlertIcon aria-hidden="true" className="size-3.5" />
        {mensajeDocumentoInvalido(data)}
      </span>
    )
  } else if (listo && data?.valido && data.terceroId !== null && data.terceroId !== terceroActualId) {
    contenido = (
      <span className="inline-flex items-center gap-1 text-warning">
        <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
        Ya existe un cliente o proveedor con ese documento.
      </span>
    )
  } else if (listo && data?.valido) {
    contenido = (
      <span className="inline-flex items-center gap-1 text-success">
        <CircleCheckIcon aria-hidden="true" className="size-3.5" />
        Documento válido.
      </span>
    )
  }
  return (
    <p id={id} aria-live="polite" className="flex min-h-5 items-center gap-1 text-xs">
      {contenido}
    </p>
  )
}
