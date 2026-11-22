// Tarjeta de un mes (docs/UI-UX.md §5.9): estado con ícono y texto, número de movimientos, TN de compras y ventas
// (con el detalle por producto), libro 12.1 (Pendiente / Impreso / Desactualizado, con enlace al libro del mes) y
// asiento (Sin asiento / Pendiente / Exportado / Desactualizado, con enlace a Asientos del mes; S11). Todo tal como
// lo entrega PeriodoDto: la web no suma nada.
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, BookOpenIcon, LandmarkIcon, ListIcon, LockOpenIcon, LockIcon } from 'lucide-react'
import type { Periodo } from '@/api/periodos'
import { RAIZ_MODULO } from '@/app/paginas'
import { ChipEstadoPeriodo } from '@/componentes/comunes/chip-estado-periodo'
import { EstadoAsiento } from '@/componentes/comunes/estado-asiento'
import { EstadoLibro121 } from '@/componentes/comunes/estado-libro-121'
import { Button } from '@/componentes/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/componentes/ui/card'
import { formatearEntero, formatearFechaHora, formatearToneladas, nombreMes } from '@/lib/formato'

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
      <dd className="flex items-start gap-2 text-sm">{icono}<span className="min-w-0">{children}</span></dd>
    </div>
  )
}

const textoMovimientos = (n: number) => (n === 1 ? '1 movimiento' : `${formatearEntero(n)} movimientos`)

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
          <Dato icono={<ListIcon aria-hidden="true" className={icono} />} termino="Movimientos">
            {p.movimientos > 0 ? textoMovimientos(p.movimientos) : <span className="text-muted-foreground">Sin movimientos</span>}
          </Dato>
          <Dato icono={<ArrowDownToLineIcon aria-hidden="true" className={icono} />} termino="Compras">
            Compras: <span className="tabular-nums">{formatearToneladas(p.comprasTn)}</span> TN
          </Dato>
          <Dato icono={<ArrowUpFromLineIcon aria-hidden="true" className={icono} />} termino="Ventas">
            Ventas: <span className="tabular-nums">{formatearToneladas(p.ventasTn)}</span> TN
          </Dato>
          {p.porProducto.length > 0 && (
            <div>
              <dt className="sr-only">Detalle por producto</dt>
              <dd className="text-xs">
                <details>
                  <summary className="w-fit cursor-pointer rounded-sm text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                    Por producto
                  </summary>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {p.porProducto.map((d) => (
                      <li key={d.productoId}>
                        <span className="font-medium">{d.productoCodigo}</span>: {textoMovimientos(d.movimientos)} · compras{' '}
                        <span className="tabular-nums">{formatearToneladas(d.comprasTn)}</span> TN · ventas{' '}
                        <span className="tabular-nums">{formatearToneladas(d.ventasTn)}</span> TN
                      </li>
                    ))}
                  </ul>
                </details>
              </dd>
            </div>
          )}
          <Dato icono={<BookOpenIcon aria-hidden="true" className={icono} />} termino="Libro 12.1">
            <span className="inline-flex flex-wrap items-center gap-x-1">
              Libro 12.1: <EstadoLibro121 estado={p.libro121.estado} impresoEn={p.libro121.impresoEn} corto />
            </span>
            <Link className="block w-fit text-xs underline underline-offset-2" aria-label={`Ver libro 12.1 de ${nombre}`}
              to={`${RAIZ_MODULO}/libros/12-1?anio=${p.anio}&mes=${p.mes}`}>
              Ver libro 12.1
            </Link>
          </Dato>
          <Dato icono={<LandmarkIcon aria-hidden="true" className={icono} />} termino="Asiento">
            <span className="inline-flex flex-wrap items-center gap-x-1">
              Asiento: <EstadoAsiento estado={p.asiento.estado} corto />
            </span>
            <Link className="block w-fit text-xs underline underline-offset-2" aria-label={`Ver asientos de ${nombre}`}
              to={`${RAIZ_MODULO}/asientos?anio=${p.anio}&mes=${p.mes}`}>
              Ver asientos
            </Link>
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
