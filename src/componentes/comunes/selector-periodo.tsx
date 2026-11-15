// Año + mes (docs/UI-UX.md §4), con "Todo el año" opcional. Selects nativos: teclado y lectores de pantalla sin
// trabajo extra. Los años van desde el inicio del histórico hasta el año en curso (Lima).
import { useId } from 'react'
import { CampoSelect } from './campo-select'
import { Label } from '@/componentes/ui/label'
import { nombreMes } from '@/lib/formato'
import { aniosDisponibles } from '@/lib/periodos'

type Props = {
  anio: number
  alCambiarAnio: (anio: number) => void
  /** null = "Todo el año". Sin `alCambiarMes` solo se muestra el año. */
  mes?: number | null
  alCambiarMes?: (mes: number | null) => void
  permitirTodoElAnio?: boolean
}

export function SelectorPeriodo({ anio, alCambiarAnio, mes = null, alCambiarMes, permitirTodoElAnio = false }: Props) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-anio`}>Año</Label>
        <CampoSelect id={`${id}-anio`} className="w-28" value={String(anio)}
          opciones={aniosDisponibles(anio).map((a) => ({ valor: String(a), texto: String(a) }))}
          onChange={(evento) => alCambiarAnio(Number.parseInt(evento.target.value, 10))} />
      </div>
      {alCambiarMes && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-mes`}>Mes</Label>
          <CampoSelect id={`${id}-mes`} className="w-40" value={mes === null ? '' : String(mes)}
            opciones={[
              ...(permitirTodoElAnio ? [{ valor: '', texto: 'Todo el año' }] : []),
              ...Array.from({ length: 12 }, (_, i) => ({ valor: String(i + 1), texto: nombreMes(i + 1) })),
            ]}
            onChange={(evento) => alCambiarMes(evento.target.value === '' ? null : Number.parseInt(evento.target.value, 10))} />
        </div>
      )}
    </div>
  )
}
