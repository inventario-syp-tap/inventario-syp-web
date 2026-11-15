// Alertas del kardex con ícono y texto (docs/UI-UX.md §4 y §7): nunca solo color. Los textos están en lib/alertas.ts.
// El color va en el ícono; el texto queda en text-foreground (contraste AA también sobre bg-muted y bg-accent).
import type { LucideIcon } from 'lucide-react'
import { ArrowDownUpIcon, OctagonXIcon, PrinterIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'
import { textoAlerta } from '@/lib/alertas'

const ESTILOS: Record<string, { icono: LucideIcon; clase: string }> = {
  STOCK_NEGATIVO: { icono: OctagonXIcon, clase: 'text-destructive' },
  FECHA_FUERA_DE_ORDEN: { icono: ArrowDownUpIcon, clase: 'text-warning' },
  SALDO_CERO_CON_COSTO: { icono: TriangleAlertIcon, clase: 'text-warning' },
  SI_DESACTUALIZADO: { icono: TriangleAlertIcon, clase: 'text-warning' },
  LIBRO_PENDIENTE_IMPRESION: { icono: PrinterIcon, clase: 'text-warning' },
}

export function IconoAlerta({ codigo }: { codigo: string }) {
  const { icono: Icono, clase } = ESTILOS[codigo] ?? { icono: TriangleAlertIcon, clase: 'text-warning' }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-foreground">
      <Icono aria-hidden="true" className={cn('size-3.5 shrink-0', clase)} />
      {textoAlerta(codigo)}
    </span>
  )
}
