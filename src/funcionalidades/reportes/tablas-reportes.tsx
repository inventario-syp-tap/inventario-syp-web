// Contenido de cada reporte (docs/UI-UX.md §5.12), tal como lo entrega la API:
//  - Toneladas: un bloque por producto y el bloque "EN TONELADAS" (TN, 4 decimales).
//  - Costo de ventas: un bloque por producto y el "RESUMEN", con COSTO DE VENTAS, MERMAS y TOTAL SALIDAS VALORIZADAS.
//  - Resumen anual: una tabla con los conceptos del año por producto (TN y S/) y el TOTAL.
//  - Margen: ventas S/, costo de ventas, margen y %, con las ventas sin precio aparte, por producto y el TOTAL.
import { CeldaCifra, TablaMensual, type ColumnaMensual } from './tabla-mensual'
import type { CostoVentas, CostoVentasMes, Margen, MargenMes, ResumenAnual, ResumenAnualFila, Toneladas, ToneladasMes } from '@/api/reportes'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'

const titulo = (p: { productoCodigo: string; descripcion: string }) => `${p.productoCodigo} · ${p.descripcion}`

const COLUMNAS_TONELADAS: ColumnaMensual<ToneladasMes>[] = [
  { id: 'si', encabezado: 'SALDO INICIAL', tipo: 'toneladas', valor: (f) => f.saldoInicial },
  { id: 'compras', encabezado: 'COMPRAS', tipo: 'toneladas', valor: (f) => f.compras },
  { id: 'otrasEntradas', encabezado: 'OTRAS ENTRADAS', tipo: 'toneladas', valor: (f) => f.otrasEntradas },
  { id: 'ventas', encabezado: 'VENTAS', tipo: 'toneladas', valor: (f) => f.ventas },
  { id: 'mermas', encabezado: 'MERMAS', tipo: 'toneladas', valor: (f) => f.mermas },
  { id: 'desmedros', encabezado: 'DESMEDROS', tipo: 'toneladas', valor: (f) => f.desmedros },
  { id: 'otrasSalidas', encabezado: 'OTRAS SALIDAS', tipo: 'toneladas', valor: (f) => f.otrasSalidas },
  { id: 'sf', encabezado: 'SALDO FINAL', tipo: 'toneladas', valor: (f) => f.saldoFinal },
]

export function ReporteToneladas({ datos }: { datos: Toneladas }) {
  return (
    <>
      {datos.productos.map((p) => (
        <TablaMensual key={p.productoId} titulo={`${titulo(p)} (TN)`} meses={p.meses} total={p.total} columnas={COLUMNAS_TONELADAS} />
      ))}
      <TablaMensual titulo="EN TONELADAS" meses={datos.enToneladas.meses} total={datos.enToneladas.total} columnas={COLUMNAS_TONELADAS} />
    </>
  )
}

const COLUMNAS_COSTO: ColumnaMensual<CostoVentasMes>[] = [
  { id: 'si', encabezado: 'SALDO INICIAL', tipo: 'importe', valor: (f) => f.saldoInicial },
  { id: 'compras', encabezado: 'COMPRAS', tipo: 'importe', valor: (f) => f.compras },
  { id: 'otrasEntradas', encabezado: 'OTRAS ENTRADAS', tipo: 'importe', valor: (f) => f.otrasEntradas },
  { id: 'sf', encabezado: 'SALDO FINAL', tipo: 'importe', valor: (f) => f.saldoFinal },
  { id: 'costoVentas', encabezado: 'COSTO DE VENTAS', tipo: 'importe', valor: (f) => f.costoVentas },
  { id: 'mermas', encabezado: 'MERMAS', tipo: 'importe', valor: (f) => f.mermas },
  { id: 'desmedros', encabezado: 'DESMEDROS', tipo: 'importe', valor: (f) => f.desmedros },
  { id: 'otrasSalidas', encabezado: 'OTRAS SALIDAS', tipo: 'importe', valor: (f) => f.otrasSalidas },
  { id: 'tsv', encabezado: 'TOTAL SALIDAS VALORIZADAS', tipo: 'importe', valor: (f) => f.totalSalidasValorizadas },
]

export function ReporteCostoVentas({ datos }: { datos: CostoVentas }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">Importes en soles (S/). COSTO DE VENTAS = salidas 01 + 17; TOTAL SALIDAS VALORIZADAS incluye las mermas.</p>
      {datos.productos.map((p) => (
        <TablaMensual key={p.productoId} titulo={titulo(p)} meses={p.meses} total={p.total} columnas={COLUMNAS_COSTO} />
      ))}
      <TablaMensual titulo="RESUMEN" meses={datos.resumen.meses} total={datos.resumen.total} columnas={COLUMNAS_COSTO} />
    </>
  )
}

type Concepto = { id: string; nombre: string; tnSoles?: (f: ResumenAnualFila) => { cantidad: string; costo: string }; soles?: (f: ResumenAnualFila) => string }

const CONCEPTOS: Concepto[] = [
  { id: 'ii', nombre: 'INVENTARIO INICIAL', tnSoles: (f) => f.inventarioInicial },
  { id: 'compras', nombre: 'COMPRAS', tnSoles: (f) => f.compras },
  { id: 'otrasEntradas', nombre: 'OTRAS ENTRADAS', tnSoles: (f) => f.otrasEntradas },
  { id: 'if', nombre: 'INVENTARIO FINAL', tnSoles: (f) => f.inventarioFinal },
  { id: 'cv', nombre: 'COSTO DE VENTAS', tnSoles: (f) => f.costoVentas },
  { id: 'mermas', nombre: 'MERMAS', tnSoles: (f) => f.mermas },
  { id: 'desmedros', nombre: 'DESMEDROS', tnSoles: (f) => f.desmedros },
  { id: 'otrasSalidas', nombre: 'OTRAS SALIDAS', tnSoles: (f) => f.otrasSalidas },
  { id: 'tsv', nombre: 'TOTAL SALIDAS VALORIZADAS', soles: (f) => f.totalSalidasValorizadas },
]

export function ReporteResumenAnual({ datos }: { datos: ResumenAnual }) {
  const columnas = [
    ...datos.productos.map((p) => ({ id: String(p.productoId), nombre: p.productoCodigo, fila: p.resumen })),
    { id: 'total', nombre: 'TOTAL', fila: datos.total },
  ]
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Resumen del año {datos.anio}</h2>
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[720px]">
          <TableCaption className="sr-only">Resumen anual {datos.anio}: conceptos por producto en TN y S/, y el total</TableCaption>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead scope="col" rowSpan={2}>CONCEPTO</TableHead>
              {columnas.map((c) => <TableHead key={c.id} scope="colgroup" colSpan={2} className="text-center">{c.nombre}</TableHead>)}
            </TableRow>
            <TableRow>
              {columnas.flatMap((c) => [
                <TableHead key={`${c.id}-tn`} scope="col" className="text-right">TN</TableHead>,
                <TableHead key={`${c.id}-s`} scope="col" className="text-right">S/</TableHead>,
              ])}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONCEPTOS.map((concepto) => (
              <TableRow key={concepto.id} className={concepto.soles ? 'font-semibold' : undefined}>
                <TableHead scope="row" className={concepto.soles ? 'text-foreground' : 'font-normal'}>{concepto.nombre}</TableHead>
                {columnas.flatMap((c) => {
                  const valor = concepto.tnSoles?.(c.fila)
                  return [
                    <TableCell key={`${c.id}-tn`} className="text-right tabular-nums">
                      {valor ? <CeldaCifra tipo="toneladas" valor={valor.cantidad} /> : <span className="sr-only">sin dato</span>}
                    </TableCell>,
                    <TableCell key={`${c.id}-s`} className="text-right tabular-nums">
                      <CeldaCifra tipo="importe" valor={valor ? valor.costo : concepto.soles?.(c.fila) ?? null} />
                    </TableCell>,
                  ]
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

const COLUMNAS_MARGEN: ColumnaMensual<MargenMes>[] = [
  { id: 'ventasTn', encabezado: 'VENTAS TN', tipo: 'toneladas', valor: (f) => f.ventasCantidad },
  { id: 'ventasS', encabezado: 'VENTAS S/', tipo: 'importe', valor: (f) => f.ventasSoles },
  { id: 'costo', encabezado: 'COSTO DE VENTAS S/', tipo: 'importe', valor: (f) => f.costoVentas },
  { id: 'margen', encabezado: 'MARGEN S/', tipo: 'importe', valor: (f) => f.margen },
  { id: 'porcentaje', encabezado: 'MARGEN %', tipo: 'porcentaje', valor: (f) => f.porcentaje },
  { id: 'sinPrecioTn', encabezado: 'VENTAS SIN PRECIO TN', tipo: 'toneladas', valor: (f) => f.sinPrecio.cantidad },
  { id: 'sinPrecioS', encabezado: 'VENTAS SIN PRECIO · COSTO S/', tipo: 'importe', valor: (f) => f.sinPrecio.costo },
]

export function ReporteMargen({ datos }: { datos: Margen }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Margen bruto = ventas S/ (valor de venta sin IGV) − costo de esas ventas. Las ventas sin valor de venta (histórico) van aparte y no
        entran en el porcentaje.
      </p>
      {datos.productos.map((p) => (
        <TablaMensual key={p.productoId} titulo={titulo(p)} meses={p.meses} total={p.total} columnas={COLUMNAS_MARGEN} />
      ))}
      <TablaMensual titulo="TOTAL DE PRODUCTOS" meses={datos.total.meses} total={datos.total.total} columnas={COLUMNAS_MARGEN} />
    </>
  )
}
