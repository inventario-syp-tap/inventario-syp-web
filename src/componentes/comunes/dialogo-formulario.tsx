// Diálogo con un formulario de alta o edición (maestros, usuarios). "Guardar" queda deshabilitado mientras envía,
// Ctrl+Enter guarda, Esc cierra (Radix) y el foco vuelve a `focoAlCerrar` (docs/UI-UX.md §6 y §7).
// El error de la API se muestra dentro del diálogo y se anuncia (role="alert").
import type { FormEventHandler, ReactNode, RefObject } from 'react'
import { cn } from 'cn'
import { EstadoError } from './estado-error'
import { Button } from '@/componentes/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/componentes/ui/dialog'
import { Kbd } from '@/componentes/ui/kbd'
import { Spinner } from '@/componentes/ui/spinner'

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  titulo: string
  descripcion?: ReactNode
  alEnviar: FormEventHandler<HTMLFormElement>
  enviando: boolean
  errorEnvio?: string | null
  /** Contenido extra junto al error (p. ej. las fechas de la regla en conflicto). */
  detalleError?: ReactNode
  textoGuardar?: string
  focoAlCerrar?: RefObject<HTMLElement | null>
  /** Ancho: normal (formularios cortos) o amplio (dos columnas). */
  amplio?: boolean
  children: ReactNode
}

export function DialogoFormulario({
  abierto, alCambiarAbierto, titulo, descripcion, alEnviar, enviando, errorEnvio, detalleError,
  textoGuardar = 'Guardar', focoAlCerrar, amplio = false, children,
}: Props) {
  return (
    <Dialog open={abierto} onOpenChange={(siguiente) => { if (!enviando || siguiente) alCambiarAbierto(siguiente) }}>
      <DialogContent
        className={cn('max-h-[90svh] overflow-y-auto', amplio ? 'sm:max-w-2xl' : 'sm:max-w-md')}
        onCloseAutoFocus={(evento) => {
          if (!focoAlCerrar?.current) return
          evento.preventDefault()
          focoAlCerrar.current.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription className={descripcion ? undefined : 'sr-only'}>
            {descripcion ?? 'Completa los campos y pulsa Guardar.'}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={alEnviar}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
              evento.preventDefault()
              if (!enviando) evento.currentTarget.requestSubmit()
            }
          }}
          className="flex flex-col gap-4"
        >
          {children}
          {errorEnvio && (
            <div className="flex flex-col gap-2">
              <EstadoError mensaje={errorEnvio} />
              {detalleError}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={enviando}>Cancelar</Button>
            </DialogClose>
            <Button type="submit" disabled={enviando}>
              {enviando && <Spinner aria-hidden="true" />}
              {enviando ? 'Guardando…' : textoGuardar}
              {!enviando && <Kbd aria-hidden="true" className="ml-1 bg-primary-foreground/20 text-primary-foreground">Ctrl+↵</Kbd>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
