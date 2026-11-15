// Tabla por mes "como la hoja del Excel" (docs/UI-UX.md §5.12): una fila por mes y la fila TOTAL que entrega la API,
// con los encabezados en mayúsculas como los usa la contadora (SALDO INICIAL, COSTO DE VENTAS, MERMAS, TOTAL SALIDAS
// VALORIZADAS). Solo formatea con lib/formato.ts: los totales vienen de la API, aquí no se suma nada.
import { Cifra } from '@/componentes/comunes/cifra'
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'
import { nombreMes } from '@/lib/formato'

export type TipoCifra = 'toneladas' | 'importe' | 'porcentaje'

export type ColumnaMensual<T> = {
  id: string
  encabezado: string
  tipo: TipoCifra
  valor: (fila: T) => string | null
}

type Props<T extends { mes: number | null }> = {
  /** Título del bloque (producto o "EN TONELADAS"); también es el caption de la tabla. */
  titulo: string
  meses: readonly T[]
  total: T
  columnas: readonly ColumnaMensual<T>[]
  /** Texto de la fila de totales (por defecto "TOTAL"). */
  textoTotal?: string
}

export function CeldaCifra({ valor, tipo }: { valor: string | null; tipo: TipoCifra }) {
  if (tipo === 'porcentaje') {
    return valor === null
      ? <span className="text-muted-foreground"><span aria-hidden="true">—</span><span className="sr-only">sin ventas con precio</span></span>
      : <span className="inline-flex items-center gap-0.5"><Cifra tipo="importe" valor={valor} /> %</span>
  }
  return <Cifra tipo={tipo} valor={valor} />
}

export function TablaMensual<T extends { mes: number | null }>({ titulo, meses, total, columnas, textoTotal = 'TOTAL' }: Props<T>) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[720px]">
          <TableCaption className="sr-only">{titulo}: valores por mes y total del año</TableCaption>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead scope="col">MES</TableHead>
              {columnas.map((c) => <TableHead key={c.id} scope="col" className="text-right whitespace-normal">{c.encabezado}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {meses.map((fila, i) => (
              <TableRow key={fila.mes ?? `fila-${i}`}>
                <TableHead scope="row" className="font-normal">{fila.mes === null ? '—' : nombreMes(fila.mes)}</TableHead>
                {columnas.map((c) => (
                  <TableCell key={c.id} className="text-right tabular-nums"><CeldaCifra valor={c.valor(fila)} tipo={c.tipo} /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableHead scope="row" className="text-foreground">{textoTotal}</TableHead>
              {columnas.map((c) => (
                <TableCell key={c.id} className="text-right tabular-nums"><CeldaCifra valor={c.valor(total)} tipo={c.tipo} /></TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </section>
  )
}
