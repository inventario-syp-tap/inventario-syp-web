// Tarjeta de un mes (docs/UI-UX.md §5.9): estado con ícono y texto, movimientos, libro 12.1 y asiento tal como los
// entrega la API (sin dato → "Pendiente"). Las TN de compras y ventas no vienen en PeriodoDto: pendiente para la API.
import type { ReactNode } from 'react'
import { BookOpenIcon, CircleDashedIcon, LandmarkIcon, LockOpenIcon, LockIcon } from 'lucide-react'
import type { Periodo } from '@/api/periodos'
import { ChipEstadoPeriodo } from '@/componentes/comunes/chip-estado-periodo'
import { Button } from '@/componentes/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/componentes/ui/card'
import { formatearFechaHora, nombreMes } from '@/lib/formato'

type Props = {
  periodo: Periodo
  puedeCerrar: boolean
  puedeReabrir: boolean
  alCerrar: (origen: HTMLElement) => void
  alReabrir: (origen: HTMLElement) => void
}

function Dato({ icono, termino, children }: { icono: ReactNode; termino: string; children: ReactNode }) {
  return (
    <div>
      <dt className="sr-only">{termino}</dt>
      <dd className="flex items-start gap-2 text-sm">{icono}<span>{children}</span></dd>
    </div>
  )
}

const pendiente = (
  <span className="inline-flex items-center gap-1 text-muted-foreground">
    <CircleDashedIcon aria-hidden="true" className="size-3.5" />
    Pendiente
  </span>
)

export function TarjetaPeriodo({ periodo: p, puedeCerrar, puedeReabrir, alCerrar, alReabrir }: Props) {
  const nombre = `${nombreMes(p.mes)} ${p.anio}`
  const icono = 'mt-0.5 size-4 shrink-0 text-muted-foreground'
  return (
    <Card size="sm" role="group" className="w-full gap-3" aria-labelledby={`periodo-${p.periodo}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle id={`periodo-${p.periodo}`} className="text-base">{nombreMes(p.mes)}</CardTitle>
        <ChipEstadoPeriodo estado={p.estado} />
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-1.5">
          <Dato icono={<CircleDashedIcon aria-hidden="true" className={icono} />} termino="Movimientos">
            {p.tieneMovimientos ? 'Con movimientos' : <span className="text-muted-foreground">Sin movimientos</span>}
          </Dato>
          <Dato icono={<BookOpenIcon aria-hidden="true" className={icono} />} termino="Libro 12.1">
            Libro 12.1: {p.libroImpreso ? `impreso el ${formatearFechaHora(p.libroImpreso.impresoEn).slice(0, 10)}` : pendiente}
          </Dato>
          <Dato icono={<LandmarkIcon aria-hidden="true" className={icono} />} termino="Asiento">
            Asiento:{' '}
            {p.asientosExportados.length > 0
              ? `exportado (${p.asientosExportados.map((a) => a.numeroAsiento).join(', ')})`
              : pendiente}
          </Dato>
          {p.estado === 'CERRADO' && p.cerradoEn && (
            <div>
              <dt className="sr-only">Cierre</dt>
              <dd className="text-xs text-muted-foreground">
                Cerrado el {formatearFechaHora(p.cerradoEn)}{p.cerradoPor ? ` por ${p.cerradoPor}` : ''}
                {p.versionCierre && p.versionCierre > 1 ? ` · cierre n.º ${p.versionCierre}` : ''}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
      {(puedeCerrar || puedeReabrir) && (
        <CardFooter className="gap-2">
          {puedeCerrar && (
            <Button type="button" size="sm" aria-label={`Cerrar ${nombre}`} onClick={(e) => alCerrar(e.currentTarget)}>
              <LockIcon aria-hidden="true" />
              Cerrar mes
            </Button>
          )}
          {puedeReabrir && (
            <Button type="button" size="sm" variant="outline" aria-label={`Reabrir ${nombre}`} onClick={(e) => alReabrir(e.currentTarget)}>
              <LockOpenIcon aria-hidden="true" />
              Reabrir
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
