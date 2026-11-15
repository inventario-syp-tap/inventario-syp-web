// Estado de un periodo (docs/UI-UX.md §4): Abierto (borde) · Cerrado (✓ success) · Sin periodo. Siempre ícono + texto.
// El color va solo en el ícono y el borde: el texto queda en text-foreground para el contraste AA sobre cualquier fondo.
import { CircleCheckIcon, CircleDashedIcon, CircleIcon } from 'lucide-react'
import { cn } from 'cn'
import type { EstadoPeriodo } from '@/api/periodos'
import { TEXTO_ESTADO_PERIODO } from '@/lib/periodos'

const ESTADOS: Record<EstadoPeriodo, { borde: string; colorIcono: string; icono: typeof CircleIcon }> = {
  ABIERTO: { borde: 'border-border', colorIcono: 'text-muted-foreground', icono: CircleIcon },
  CERRADO: { borde: 'border-success', colorIcono: 'text-success', icono: CircleCheckIcon },
  SIN_PERIODO: { borde: 'border-dashed border-border', colorIcono: 'text-muted-foreground', icono: CircleDashedIcon },
}

type Props = {
  estado: EstadoPeriodo
  /** Texto antes del estado ("Noviembre 2026"). */
  prefijo?: string
  className?: string
}

export function ChipEstadoPeriodo({ estado, prefijo, className }: Props) {
  const { borde, colorIcono, icono: Icono } = ESTADOS[estado]
  const texto = TEXTO_ESTADO_PERIODO[estado]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground', borde, className)}>
      <Icono aria-hidden="true" className={cn('size-3.5 shrink-0', colorIcono)} />
      {prefijo && <span>{prefijo} ·</span>}
      {texto}
    </span>
  )
}
