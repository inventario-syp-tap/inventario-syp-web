// <select> nativo con el aspecto de Input. Se prefiere al Select de Radix en formularios densos: funciona con
// teclado y lectores de pantalla sin trabajo extra, se integra con react-hook-form (register) y se prueba en jsdom.
import type { ComponentProps } from 'react'
import { cn } from 'cn'

export type OpcionSelect = { valor: string; texto: string; deshabilitada?: boolean }

type Props = Omit<ComponentProps<'select'>, 'children'> & {
  opciones: readonly OpcionSelect[]
  /** Primera opción vacía ("Elige…"). */
  vacio?: string
}

export function CampoSelect({ opciones, vacio, className, ...props }: Props) {
  return (
    <select
      data-slot="campo-select"
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-70',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30',
        className,
      )}
      {...props}
    >
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor} disabled={opcion.deshabilitada}>
          {opcion.texto}
        </option>
      ))}
    </select>
  )
}
