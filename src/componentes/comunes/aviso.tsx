// Aviso con ícono + título + texto (nada solo por color, docs/UI-UX.md §7). Informativo (ya cargado, demostración),
// advertencia, éxito o error (encabezado de un formulario: periodo cerrado, stock insuficiente…), con acciones
// opcionales ("Reintentar"). Los errores se anuncian con role="alert"; lo demás con role="status".
import type { ReactNode } from 'react'
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'

type Tono = 'info' | 'advertencia' | 'exito' | 'error'

const ESTILO: Record<Tono, string> = {
  info: 'border-border',
  advertencia: 'border-warning',
  exito: 'border-success',
  error: 'border-destructive',
}

const ICONO: Record<Tono, ReactNode> = {
  info: <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />,
  advertencia: <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />,
  exito: <CircleCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />,
  error: <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />,
}

type Props = {
  tono: Tono
  titulo: string
  children?: ReactNode
  acciones?: ReactNode
  className?: string
}

export function Aviso({ tono, titulo, children, acciones, className }: Props) {
  return (
    <div role={tono === 'error' ? 'alert' : 'status'} className={cn('flex flex-wrap gap-3 rounded-md border p-3 text-sm', ESTILO[tono], className)}>
      {ICONO[tono]}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('font-medium', tono === 'error' && 'text-destructive')}>{titulo}</p>
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
      {acciones && <div className="flex shrink-0 items-start gap-2">{acciones}</div>}
    </div>
  )
}
