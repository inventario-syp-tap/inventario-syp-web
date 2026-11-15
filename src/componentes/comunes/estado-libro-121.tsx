// Estado del libro 12.1 de un mes (PeriodoDto.libro121 o GET /libros/12-1/impresiones), siempre con ícono y texto:
// Pendiente · ✓ Impreso dd/mm/aaaa · ⚠ Impresión desactualizada: vuelve a imprimir. El color va solo en el ícono.
import { CircleCheckIcon, CircleDashedIcon, TriangleAlertIcon } from 'lucide-react'
import { cn } from 'cn'
import type { EstadoLibro121 as Estado } from '@/api/libros'
import { formatearFechaInstante } from '@/lib/formato'

type Props = {
  estado: Estado
  impresoEn: string | null
  /** corto: "Desactualizado" (tarjetas de Periodos); largo: "Impresión desactualizada: vuelve a imprimir". */
  corto?: boolean
  className?: string
}

export function EstadoLibro121({ estado, impresoEn, corto = false, className }: Props) {
  const clase = cn('inline-flex items-center gap-1', className)
  if (estado === 'IMPRESO') {
    return (
      <span className={clase}>
        <CircleCheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        Impreso{impresoEn ? ` ${formatearFechaInstante(impresoEn)}` : ''}
      </span>
    )
  }
  if (estado === 'DESACTUALIZADO') {
    return (
      <span className={clase}>
        <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
        {corto ? 'Desactualizado' : 'Impresión desactualizada: vuelve a imprimir'}
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
