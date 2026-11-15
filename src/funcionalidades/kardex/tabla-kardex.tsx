// Tabla del kardex "tipo Excel" (docs/UI-UX.md §5.8): Fecha · Comprobante · Op · Tercero/descripción y los grupos
// ENTRADAS / SALIDAS / SALDO con Cant., C.U. y Total. Fila SALDO INICIAL y subtotal por mes en negrita (bg-muted).
// Cabecera y las dos primeras columnas quedan fijas al desplazarse. Todos los valores son los de GET /kardex,
// formateados con big.js (lib/formato.ts): la web no calcula costos ni saldos.
import type { ReactNode } from 'react'
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'
import { cn } from 'cn'
import type { FilaKardex, Kardex, MesKardex, SaldoKardex } from '@/api/kardex'
import { ChipEstadoPeriodo } from '@/componentes/comunes/chip-estado-periodo'
import { Cifra } from '@/componentes/comunes/cifra'
import { IconoAlerta } from '@/componentes/comunes/icono-alerta'
import { Button } from '@/componentes/ui/button'
import { documentoFila } from './filtros-url'
import { formatearFecha, nombreMes } from '@/lib/formato'

export type Direccion = 'ARRIBA' | 'ABAJO'

type Props = {
  kardex: Kardex
  detallado: boolean
  /** Muestra ↑/↓ (A, C) en los meses abiertos. */
  puedeReordenar: boolean
  /** Fila marcada por el enlace de una alerta (#fila-<id>). */
  filaResaltada: string | null
  alVer: (fila: FilaKardex, origen: HTMLElement | null) => void
  alMover: (fila: FilaKardex, direccion: Direccion, origen: HTMLElement) => void
}

// Las dos primeras columnas quedan fijas a la izquierda: anchos fijos para que no se encimen.
const FIJA_FECHA = 'sticky left-0 z-10 w-24 min-w-24'
const FIJA_COMPROBANTE = 'sticky left-24 z-10 min-w-44 border-r'
const CELDA = 'h-8 px-2 whitespace-nowrap'
const NUM = `${CELDA} text-right`

function CeldasSaldo({ saldo }: { saldo: SaldoKardex }) {
  return (
    <>
      <td className={NUM}><Cifra tipo="toneladas" valor={saldo.cantidad} /></td>
      <td className={NUM}><Cifra tipo="cu" valor={saldo.costoUnitario} /></td>
      <td className={cn(NUM, 'border-r')}><Cifra tipo="importe" valor={saldo.costoTotal} /></td>
    </>
  )
}

const Vacias = ({ n, borde = true }: { n: number; borde?: boolean }) =>
  Array.from({ length: n }, (_, i) => <td key={i} className={cn(CELDA, borde && i === n - 1 && 'border-r')} />)

export function TablaKardex({ kardex, detallado, puedeReordenar, filaResaltada, alVer, alMover }: Props) {
  const columnasTexto = detallado ? 5 : 4
  const conOrden = puedeReordenar
  const titulo = `Kardex de ${kardex.producto.codigo} · ${kardex.mes ? `${nombreMes(kardex.mes)} ${kardex.anio}` : `Año ${kardex.anio}`}`
  const unSoloMes = kardex.mes !== null
  const meses = unSoloMes ? kardex.meses : kardex.meses.filter((m) => m.filas.length > 0)

  const filaSaldoInicial = (
    <tr className="bg-muted font-semibold">
      <th scope="row" colSpan={2} className={cn(CELDA, 'sticky left-0 z-10 bg-muted text-left')}>SALDO INICIAL</th>
      <Vacias n={columnasTexto - 2} />
      <Vacias n={3} />
      <Vacias n={3} />
      <CeldasSaldo saldo={kardex.saldoInicial} />
      <td className={CELDA}>
        {kardex.saldoInicialAnio?.desactualizado && <IconoAlerta codigo="SI_DESACTUALIZADO" />}
      </td>
      {conOrden && <td className={CELDA} />}
    </tr>
  )

  const filaMovimiento = (fila: FilaKardex, mes: MesKardex, indice: number): ReactNode => {
    const documento = documentoFila(fila)
    const anterior = mes.filas[indice - 1]
    const siguiente = mes.filas[indice + 1]
    const reordenable = conOrden && mes.estado !== 'CERRADO'
    const resaltada = filaResaltada === fila.movimientoId
    // Las celdas fijas tienen fondo propio (para tapar lo que pasa por debajo): el hover de la fila les llega con group-hover.
    const fondo = resaltada ? 'bg-accent' : 'bg-card group-hover:bg-accent'
    return (
      <tr key={fila.movimientoId} id={`fila-${fila.movimientoId}`} tabIndex={resaltada ? -1 : undefined}
        aria-current={resaltada ? 'true' : undefined}
        className={cn('group cursor-pointer border-t outline-none focus-visible:ring-3 focus-visible:ring-ring/50', fondo)}
        onClick={() => alVer(fila, null)}>
        <td className={cn(CELDA, FIJA_FECHA, fondo, 'tabular-nums')}>{formatearFecha(fila.fecha)}</td>
        <td className={cn(CELDA, FIJA_COMPROBANTE, fondo)}>
          <span className="mr-1 font-mono text-xs text-muted-foreground">{fila.tipoComprobante}</span>
          <Button type="button" variant="link" size="sm" className="h-auto p-0 font-mono" aria-label={`Ver ${documento} del ${formatearFecha(fila.fecha)}`}
            onClick={(evento) => {
              evento.stopPropagation()
              alVer(fila, evento.currentTarget)
            }}>
            {documento}
          </Button>
        </td>
        <td className={cn(CELDA, 'font-mono')}>{fila.tipoOperacion}</td>
        <td className={cn(CELDA, detallado ? 'min-w-72 whitespace-normal' : 'max-w-56 truncate')}
          title={detallado ? undefined : [fila.tercero?.razonSocial, fila.descripcion].filter(Boolean).join(' · ')}>
          {fila.tercero?.razonSocial ?? fila.descripcion}
          {detallado && fila.tercero && <span className="block text-xs text-muted-foreground">{fila.descripcion}</span>}
        </td>
        {detallado && <td className={cn(CELDA, 'font-mono text-xs')}>{fila.tercero?.numeroDocumento ?? '—'}</td>}
        {fila.entrada ? (
          <>
            <td className={NUM}><Cifra tipo="toneladas" valor={fila.entrada.cantidad} /></td>
            <td className={NUM}><Cifra tipo="cu" valor={fila.entrada.costoUnitario} /></td>
            <td className={cn(NUM, 'border-r')}><Cifra tipo="importe" valor={fila.entrada.costoTotal} /></td>
          </>
        ) : <Vacias n={3} />}
        {fila.salida ? (
          <>
            <td className={NUM}><Cifra tipo="toneladas" valor={fila.salida.cantidad} /></td>
            <td className={NUM}><Cifra tipo="cu" valor={fila.salida.costoUnitario} /></td>
            <td className={cn(NUM, 'border-r')}><Cifra tipo="importe" valor={fila.salida.costoTotal} /></td>
          </>
        ) : <Vacias n={3} />}
        <CeldasSaldo saldo={fila.saldo} />
        <td className={CELDA}>
          {fila.alertas.length > 0 && (
            <span className="flex flex-col gap-0.5">{fila.alertas.map((a) => <IconoAlerta key={a} codigo={a} />)}</span>
          )}
        </td>
        {conOrden && (
          <td className={CELDA} onClick={(evento) => evento.stopPropagation()}>
            {reordenable && (
              <span className="flex gap-0.5">
                {anterior?.fecha === fila.fecha && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir ${documento} del ${formatearFecha(fila.fecha)}`}
                    onClick={(evento) => alMover(fila, 'ARRIBA', evento.currentTarget)}>
                    <ArrowUpIcon aria-hidden="true" />
                  </Button>
                )}
                {siguiente?.fecha === fila.fecha && (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Bajar ${documento} del ${formatearFecha(fila.fecha)}`}
                    onClick={(evento) => alMover(fila, 'ABAJO', evento.currentTarget)}>
                    <ArrowDownIcon aria-hidden="true" />
                  </Button>
                )}
              </span>
            )}
          </td>
        )}
      </tr>
    )
  }

  const filaSubtotal = (mes: MesKardex) => (
    <tr key={`subtotal-${mes.mes}`} className="border-t-2 bg-muted font-semibold">
      <th scope="row" colSpan={2} className={cn(CELDA, 'sticky left-0 z-10 bg-muted text-left')}>
        <span className="inline-flex items-center gap-2">
          {nombreMes(mes.mes).toUpperCase()}
          <ChipEstadoPeriodo estado={mes.estado} />
        </span>
      </th>
      <Vacias n={columnasTexto - 2} />
      <td className={NUM}><Cifra tipo="toneladas" valor={mes.entradas.cantidad} /></td>
      <td className={CELDA} />
      <td className={cn(NUM, 'border-r')}><Cifra tipo="importe" valor={mes.entradas.costoTotal} /></td>
      <td className={NUM}><Cifra tipo="toneladas" valor={mes.salidas.cantidad} /></td>
      <td className={CELDA} />
      <td className={cn(NUM, 'border-r')}><Cifra tipo="importe" valor={mes.salidas.costoTotal} /></td>
      <CeldasSaldo saldo={mes.saldoFinal} />
      <td className={CELDA} />
      {conOrden && <td className={CELDA} />}
    </tr>
  )

  const encabezado = 'h-8 px-2 font-medium whitespace-nowrap bg-primary text-primary-foreground'
  return (
    <div className="relative max-h-[70svh] overflow-auto rounded-md border text-[13px]">
      <table className="w-max min-w-full border-separate border-spacing-0">
        <caption className="sr-only">{titulo}. Valores calculados por el sistema; montos en soles.</caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2} className={cn(encabezado, 'sticky top-0 left-0 z-30 w-24 min-w-24 text-left')}>Fecha</th>
            <th scope="col" rowSpan={2} className={cn(encabezado, 'sticky top-0 left-24 z-30 min-w-44 border-r border-primary-foreground/30 text-left')}>Comprobante</th>
            <th scope="col" rowSpan={2} className={cn(encabezado, 'sticky top-0 z-20 text-left')}>Op</th>
            <th scope="col" rowSpan={2} className={cn(encabezado, 'sticky top-0 z-20 text-left')}>Tercero / descripción</th>
            {detallado && <th scope="col" rowSpan={2} className={cn(encabezado, 'sticky top-0 z-20 text-left')}>RUC / DNI</th>}
            <th scope="colgroup" colSpan={3} className={cn(encabezado, 'sticky top-0 z-20 border-x border-primary-foreground/30 text-center')}>ENTRADAS</th>
            <th scope="colgroup" colSpan={3} className={cn(encabezado, 'sticky top-0 z-20 border-r border-primary-foreground/30 text-center')}>SALIDAS</th>
            <th scope="colgroup" colSpan={3} className={cn(encabezado, 'sticky top-0 z-20 border-r border-primary-foreground/30 text-center')}>SALDO</th>
            <th scope="col" rowSpan={2} className={cn(encabezado, 'sticky top-0 z-20 text-left')}>Alertas</th>
            {conOrden && <th scope="col" rowSpan={2} className={cn(encabezado, 'sticky top-0 z-20 text-left')}>Orden</th>}
          </tr>
          <tr>
            {['ENTRADAS', 'SALIDAS', 'SALDO'].map((grupo) => (
              <SubEncabezados key={grupo} grupo={grupo} clase={encabezado} />
            ))}
          </tr>
        </thead>
        <tbody>
          {filaSaldoInicial}
          {meses.flatMap((mes) => [...mes.filas.map((fila, i) => filaMovimiento(fila, mes, i)), filaSubtotal(mes)])}
        </tbody>
      </table>
    </div>
  )
}

function SubEncabezados({ grupo, clase }: { grupo: string; clase: string }) {
  const comun = cn(clase, 'sticky top-8 z-20 text-right')
  const nombre = grupo.toLowerCase()
  return (
    <>
      <th scope="col" className={comun}><span aria-hidden="true">Cant.</span><span className="sr-only">Cantidad TN de {nombre}</span></th>
      <th scope="col" className={comun}><span aria-hidden="true">C.U.</span><span className="sr-only">Costo unitario de {nombre}</span></th>
      <th scope="col" className={cn(comun, 'border-r border-primary-foreground/30')}><span aria-hidden="true">Total</span><span className="sr-only">Total S/ de {nombre}</span></th>
    </>
  )
}
