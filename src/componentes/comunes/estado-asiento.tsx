// Estado de la exportación a WinConta de un asiento (PeriodoDto.asiento o ExportacionVigenteDto), siempre con ícono
// y texto, igual que EstadoLibro121: Sin asiento · Pendiente · ✓ Exportado · ⚠ Desactualizado. El color va solo en
// el ícono (contraste AA del texto en ambos temas).
import { CircleCheckIcon, CircleDashedIcon, CircleMinusIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'
import { formatearFechaInstante } from '@/lib/formato'

export type EstadoAsientoValor = 'SIN_ASIENTO' | 'PENDIENTE' | 'EXPORTADO' | 'DESACTUALIZADO'

type Props = {
  estado: EstadoAsientoValor
  /** N.° de asiento de WinConta y fecha de la exportación vigente (si se conocen). */
  numeroAsiento?: string | null
  exportadoEn?: string | null
  /** corto: "Desactualizado" (tarjetas de Periodos); largo: "Exportación desactualizada: vuelve a exportar". */
  corto?: boolean
  className?: string
}

export function EstadoAsiento({ estado, numeroAsiento, exportadoEn, corto = false, className }: Props) {
  const clase = cn('inline-flex items-center gap-1', className)
  if (estado === 'EXPORTADO') {
    return (
      <span className={clase}>
        <CircleCheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        Exportado{numeroAsiento ? ` (n.º ${numeroAsiento})` : ''}{exportadoEn ? ` ${formatearFechaInstante(exportadoEn)}` : ''}
      </span>
    )
  }
  if (estado === 'DESACTUALIZADO') {
    return (
      <span className={clase}>
        <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
        {corto ? 'Desactualizado' : 'Exportación desactualizada: vuelve a exportar'}
      </span>
    )
  }
  if (estado === 'SIN_ASIENTO') {
    return (
      <span className={cn(clase, 'text-muted-foreground')}>
        <CircleMinusIcon aria-hidden="true" className="size-3.5 shrink-0" />
        Sin asiento
      </span>
    )
  }
  return (
    <span className={cn(clase, 'text-muted-foreground')}>
      <CircleDashedIcon aria-hidden="true" className="size-3.5 shrink-0" />
      Pendiente
    </span>
  )
}
