// Contraseña temporal (docs/UI-UX.md §5.18): se muestra UNA sola vez, con botón Copiar y el aviso
// "No se volverá a mostrar". Vive solo en el estado de este diálogo: al cerrarlo se descarta (nunca va a la caché
// de consultas, a localStorage ni a ningún registro).
import { useState, type RefObject } from 'react'
import { CheckIcon, CopyIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/componentes/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/componentes/ui/dialog'

export const HORAS_VIGENCIA_TEMPORAL = 72

type Props = {
  /** null = cerrado. */
  datos: { email: string; password: string } | null
  alCerrar: () => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoPasswordTemporal({ datos, alCerrar, focoAlCerrar }: Props) {
  const [copiado, setCopiado] = useState<'si' | 'error' | null>(null)

  const copiar = async () => {
    if (!datos) return
    try {
      await navigator.clipboard.writeText(datos.password)
      setCopiado('si')
    } catch {
      setCopiado('error')
    }
  }

  return (
    <Dialog
      open={datos !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          setCopiado(null)
          alCerrar()
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        // Un clic fuera no la descarta: se muestra una sola vez (§5.18). Esc sí cierra (§6).
        onInteractOutside={(evento) => evento.preventDefault()}
        onCloseAutoFocus={(evento) => {
          if (!focoAlCerrar?.current) return
          evento.preventDefault()
          focoAlCerrar.current.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Contraseña temporal</DialogTitle>
          <DialogDescription>
            Entrégasela a {datos?.email} por un medio seguro. Al ingresar deberá cambiarla; vence en {HORAS_VIGENCIA_TEMPORAL} horas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <output
            aria-label="Contraseña temporal"
            className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-base tracking-wide break-all select-all"
          >
            {datos?.password}
          </output>
          <Button type="button" variant="outline" onClick={() => void copiar()}>
            {copiado === 'si' ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copiado === 'si' ? 'Copiada' : 'Copiar'}
          </Button>
        </div>
        <p aria-live="polite" className="min-h-5 text-xs">
          {copiado === 'si' && 'Contraseña copiada al portapapeles.'}
          {copiado === 'error' && <span className="text-destructive">No se pudo copiar: selecciónala y cópiala a mano.</span>}
        </p>
        <p className="flex items-start gap-2 rounded-md border border-warning p-2 text-sm">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          No se volverá a mostrar. Si se pierde, restablece la contraseña otra vez.
        </p>
        <DialogFooter>
          <Button type="button" onClick={() => { setCopiado(null); alCerrar() }}>Ya la guardé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
