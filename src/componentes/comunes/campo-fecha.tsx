// Fecha de negocio (docs/UI-UX.md §4): <input type="date"> nativo, valor "YYYY-MM-DD" como texto. Nunca se
// convierte con new Date('YYYY-MM-DD') (se correría un día por la zona horaria). El mes cerrado lo marca quien lo usa.
import type { ComponentProps } from 'react'
import { cn } from 'cn'
import { Input } from '@/componentes/ui/input'

type Props = Omit<ComponentProps<'input'>, 'type'>

export function CampoFecha({ className, ...props }: Props) {
  return <Input type="date" autoComplete="off" className={cn('h-9 w-full tabular-nums', className)} {...props} />
}
