// Componentes compartidos de la toma de inventario: pasos del asistente, estado de la toma y tipo de diferencia
// (siempre con ícono y texto, nunca solo color).
import type { Ref } from 'react'
import {
  ArrowDownIcon, ArrowUpIcon, CheckIcon, CircleCheckIcon, CircleDashedIcon, EqualIcon, LockIcon, RefreshCwIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { PASOS } from './utilidades'
import type { LineaToma, Toma } from '@/api/tomas-inventario'
import { formatearFechaHora } from '@/lib/formato'

/** Indicador de pasos (1 a 4). `actual` empieza en 1; los anteriores quedan como completados. */
export function Pasos({ actual, completo = false }: { actual: number; completo?: boolean }) {
  return (
    <ol aria-label="Pasos de la toma de inventario" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {PASOS.map((paso, i) => {
        const numero = i + 1
        const hecho = completo || numero < actual
        const esActual = !completo && numero === actual
        return (
          <li key={paso} aria-current={esActual ? 'step' : undefined}
            className={cn('inline-flex items-center gap-2', esActual ? 'font-semibold' : 'text-muted-foreground')}>
            <span aria-hidden="true" className={cn(
              'inline-flex size-6 items-center justify-center rounded-full border text-xs',
              esActual && 'border-primary bg-primary text-primary-foreground',
              hecho && 'border-success',
            )}>
              {hecho ? <CheckIcon className="size-3.5 text-success" /> : numero}
            </span>
            {paso}
            {hecho && <span className="sr-only"> (completado)</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** Título de un paso que recibe el foco al llegar a él (el lector de pantalla anuncia dónde está la persona). */
export function TituloPaso({ numero, children, refTitulo }: { numero: number; children: string; refTitulo?: Ref<HTMLHeadingElement> }) {
  return (
    <h2 ref={refTitulo} tabIndex={-1} className="text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
      Paso {numero} de {PASOS.length}: {children}
    </h2>
  )
}

/** Estado de una toma con ícono y texto: Borrador · Lista para cerrar · Cerrada · Reemplazada. */
export function EstadoToma({ toma, reemplazadaPor }: { toma: Pick<Toma, 'estado' | 'resuelta'>; reemplazadaPor?: Pick<Toma, 'creadoEn'> }) {
  if (toma.estado === 'CERRADA') {
    return (
      <span className="inline-flex items-center gap-1">
        <LockIcon aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        Cerrada
      </span>
    )
  }
  if (reemplazadaPor) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <RefreshCwIcon aria-hidden="true" className="size-3.5 shrink-0" />
        Reemplazada por la toma del {formatearFechaHora(reemplazadaPor.creadoEn)}
      </span>
    )
  }
  if (toma.resuelta) {
    return (
      <span className="inline-flex items-center gap-1">
        <CircleCheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        Resuelta · falta cerrarla
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <CircleDashedIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
      Borrador
    </span>
  )
}

export function TipoDiferencia({ linea }: { linea: Pick<LineaToma, 'tipoDiferencia' | 'dentroDeTolerancia'> }) {
  const tolerancia = linea.dentroDeTolerancia && linea.tipoDiferencia !== 'SIN_DIFERENCIA'
    ? <span className="block text-xs text-muted-foreground">Dentro de la tolerancia</span>
    : null
  if (linea.tipoDiferencia === 'FALTANTE') {
    return (
      <span>
        <span className="inline-flex items-center gap-1 font-medium">
          <ArrowDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-destructive" />
          Faltante
        </span>
        {tolerancia}
      </span>
    )
  }
  if (linea.tipoDiferencia === 'SOBRANTE') {
    return (
      <span>
        <span className="inline-flex items-center gap-1 font-medium">
          <ArrowUpIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
          Sobrante
        </span>
        {tolerancia}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <EqualIcon aria-hidden="true" className="size-3.5 shrink-0" />
      Sin diferencia
    </span>
  )
}
