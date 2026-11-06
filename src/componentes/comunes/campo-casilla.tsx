// Casilla (checkbox de Radix) con su etiqueta, para usar con <Controller> de react-hook-form.
import type { Ref } from 'react'
import { Checkbox } from '@/componentes/ui/checkbox'
import { Label } from '@/componentes/ui/label'

type Props = {
  id: string
  etiqueta: string
  marcado: boolean
  alCambiar: (marcado: boolean) => void
  deshabilitado?: boolean
  ref?: Ref<HTMLButtonElement>
  'aria-describedby'?: string
}

export function CampoCasilla({ id, etiqueta, marcado, alCambiar, deshabilitado, ref, ...aria }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        ref={ref}
        checked={marcado}
        disabled={deshabilitado}
        onCheckedChange={(valor) => alCambiar(valor === true)}
        {...aria}
      />
      <Label htmlFor={id}>{etiqueta}</Label>
    </div>
  )
}
