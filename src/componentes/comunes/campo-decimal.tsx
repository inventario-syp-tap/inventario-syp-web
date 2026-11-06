// Campo de decimales (docs/UI-UX.md §4): texto con inputMode="decimal", acepta coma o punto, limita los decimales
// (4 TN, 6 precios, 3 tipo de cambio), alineado a la derecha y sin flechas. Siempre entrega un string con punto:
// nunca se convierte a number (la API recibe y valida decimales como string).
import type { ComponentProps } from 'react'
import { cn } from 'cn'
import { Input } from '@/componentes/ui/input'
import { normalizarDecimal } from '@/lib/decimales'

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  valor: string
  alCambiar: (valor: string) => void
  decimales: number
  /** Permite el signo menos al inicio (por defecto no). */
  permitirNegativo?: boolean
}

export function CampoDecimal({ valor, alCambiar, decimales, permitirNegativo = false, className, onBlur, ...props }: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={valor}
      className={cn('text-right tabular-nums', className)}
      onChange={(evento) => {
        const normalizado = normalizarDecimal(evento.target.value, decimales, permitirNegativo)
        if (normalizado !== null) alCambiar(normalizado)
      }}
      onBlur={(evento) => {
        // "5." → "5" y ".5" → "0.5" al salir del campo
        let final = valor.endsWith('.') ? valor.slice(0, -1) : valor
        if (final.startsWith('.')) final = `0${final}`
        if (final.startsWith('-.')) final = `-0${final.slice(1)}`
        if (final !== valor) alCambiar(final)
        onBlur?.(evento)
      }}
    />
  )
}
