// Decimal de la API (string) formateado con lib/formato.ts (docs/UI-UX.md §4). Negativos en text-destructive,
// con signo menos, ícono y el texto "negativo" para lectores de pantalla (nada solo por color).
import { OctagonXIcon } from 'lucide-react'
import { cn } from 'cn'
import { formatearCU, formatearSoles, formatearToneladas } from '@/lib/formato'

type Tipo = 'toneladas' | 'soles' | 'cu'

const FORMATO: Record<Tipo, (valor: string) => string> = {
  toneladas: formatearToneladas,
  soles: formatearSoles,
  cu: (valor) => formatearCU(valor),
}

export function Cifra({ valor, tipo, className }: { valor: string | null | undefined; tipo: Tipo; className?: string }) {
  const texto = FORMATO[tipo](valor ?? '')
  const negativo = texto.includes('-')
  return (
    <span className={cn('inline-flex items-center justify-end gap-1 tabular-nums', negativo && 'text-destructive', className)}>
      {negativo && <OctagonXIcon aria-hidden="true" className="size-3.5 shrink-0" />}
      {texto}
      {negativo && <span className="sr-only"> (negativo)</span>}
    </span>
  )
}
