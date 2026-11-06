// Activo / Inactivo con ícono y texto (nada solo por color, docs/UI-UX.md §7).
import { CircleCheckIcon, CircleMinusIcon } from 'lucide-react'

export function EstadoActivo({ activo, textoActivo = 'Activo', textoInactivo = 'Inactivo' }: {
  activo: boolean
  textoActivo?: string
  textoInactivo?: string
}) {
  return activo ? (
    <span className="inline-flex items-center gap-1 text-success">
      <CircleCheckIcon aria-hidden="true" className="size-3.5" />
      {textoActivo}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <CircleMinusIcon aria-hidden="true" className="size-3.5" />
      {textoInactivo}
    </span>
  )
}
