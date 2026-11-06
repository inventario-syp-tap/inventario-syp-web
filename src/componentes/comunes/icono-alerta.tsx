// Alertas del kardex con ícono y texto (docs/UI-UX.md §4 y §7): nunca solo color.
import type { LucideIcon } from 'lucide-react'
import { ArrowDownUpIcon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'

const ALERTAS: Record<string, { icono: LucideIcon; texto: string; clase: string }> = {
  STOCK_NEGATIVO: { icono: OctagonXIcon, texto: 'Stock negativo', clase: 'text-destructive' },
  FECHA_FUERA_DE_ORDEN: { icono: ArrowDownUpIcon, texto: 'Fecha anterior al movimiento previo', clase: 'text-warning' },
  SALDO_CERO_CON_COSTO: { icono: TriangleAlertIcon, texto: 'Saldo cero con costo', clase: 'text-warning' },
  SI_DESACTUALIZADO: { icono: TriangleAlertIcon, texto: 'Saldo inicial desactualizado', clase: 'text-warning' },
}

export function IconoAlerta({ codigo }: { codigo: string }) {
  const alerta = ALERTAS[codigo] ?? { icono: TriangleAlertIcon, texto: codigo, clase: 'text-warning' }
  const Icono = alerta.icono
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', alerta.clase)}>
      <Icono aria-hidden="true" className="size-3.5 shrink-0" />
      {alerta.texto}
    </span>
  )
}
