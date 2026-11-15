// Vista previa del libro 12.1 (docs/UI-UX.md §5.11): imita la hoja A4 horizontal del PDF, un bloque por mes y
// producto, con la zona del sello y sin folio. Las cifras se muestran TAL COMO LLEGAN de la API (ya redondeadas como
// se imprimen: entradas/salidas 3 decimales, saldos y totales 2); aquí no se calcula ni se reformatea nada.
// La impresión oficial es el PDF de la API: esta vista no se imprime con el navegador (§8).
import type { BloqueLibro121 } from '@/api/libros'

const celda = 'border border-border px-1.5 py-1'
const numero = `${celda} text-right tabular-nums`

function Bloque({ bloque }: { bloque: BloqueLibro121 }) {
  const c = bloque.cabecera
  const titulo = `Libro 12.1 · ${c.periodo} · ${c.codigoExistencia}`
  return (
    <article aria-label={titulo}
      className="mx-auto w-full max-w-[1100px] rounded-sm border bg-card p-4 text-xs leading-tight text-card-foreground shadow-sm sm:p-6 print:hidden">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-semibold">REGISTRO DEL INVENTARIO PERMANENTE EN UNIDADES FÍSICAS</p>
          <p className="font-semibold">DETALLE DEL INVENTARIO PERMANENTE EN UNIDADES FÍSICAS</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt>PERÍODO:</dt><dd>{c.periodo}</dd>
            <dt>RUC:</dt><dd className="font-mono">{c.ruc}</dd>
            <dt>APELLIDOS Y NOMBRES, DENOMINACIÓN O RAZÓN SOCIAL:</dt><dd>{c.razonSocial}</dd>
            <dt>ESTABLECIMIENTO:</dt><dd>{c.establecimiento}</dd>
            <dt>CÓDIGO DE LA EXISTENCIA:</dt><dd>{c.codigoExistencia}</dd>
            <dt>TIPO (TABLA 5):</dt><dd>{c.tipoExistencia}</dd>
            <dt>DESCRIPCIÓN:</dt><dd>{c.descripcion}</dd>
            <dt>CÓDIGO DE LA UNIDAD DE MEDIDA (TABLA 6):</dt><dd>{c.unidadMedida}</dd>
          </dl>
        </div>
        <div aria-hidden="true"
          className="flex h-[30mm] w-[70mm] max-w-[40%] shrink-0 items-center justify-center rounded-sm border border-dashed text-muted-foreground">
          zona del sello
        </div>
      </header>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <caption className="sr-only">{titulo}: movimientos en unidades físicas</caption>
          <thead>
            <tr>
              <th scope="col" colSpan={4} className={celda}>DOCUMENTO DE TRASLADO, COMPROBANTE DE PAGO, DOCUMENTO INTERNO O SIMILAR</th>
              <th scope="col" rowSpan={2} className={celda}>TIPO DE OPERACIÓN (TABLA 12)</th>
              <th scope="col" rowSpan={2} className={celda}>ENTRADAS</th>
              <th scope="col" rowSpan={2} className={celda}>SALIDAS</th>
              <th scope="col" rowSpan={2} className={celda}>SALDO FINAL</th>
            </tr>
            <tr>
              <th scope="col" className={celda}>FECHA</th>
              <th scope="col" className={celda}>TIPO (TABLA 10)</th>
              <th scope="col" className={celda}>SERIE</th>
              <th scope="col" className={celda}>NÚMERO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" colSpan={5} className={`${celda} text-left font-normal`}>SALDO INICIAL</th>
              <td className={numero}>{bloque.saldoInicial.entrada}</td>
              <td className={numero} />
              <td className={numero}>{bloque.saldoInicial.saldo}</td>
            </tr>
            {bloque.filas.map((f, i) => (
              <tr key={`${f.fecha}-${f.serie}-${f.numero}-${i}`}>
                <td className={celda}>{f.fecha}</td>
                <td className={celda}>{f.tipoT10}</td>
                <td className={celda}>{f.serie}</td>
                <td className={`${celda} font-mono`}>{f.numero}</td>
                <td className={celda}>{f.tipoOperacionT12}</td>
                <td className={numero}>{f.entrada}</td>
                <td className={numero}>{f.salida}</td>
                <td className={numero}>{f.saldo}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" colSpan={5} className={`${celda} text-right`}>TOTALES</th>
              <td className={numero}>{bloque.totales.entradas}</td>
              <td className={numero}>{bloque.totales.salidas}</td>
              <td className={numero}>{bloque.saldoFinal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  )
}

export function VistaPrevia121({ bloques }: { bloques: readonly BloqueLibro121[] }) {
  return (
    <section aria-label="Vista previa del libro 12.1" className="flex flex-col gap-4 rounded-md bg-muted p-2 sm:p-4">
      {bloques.map((b) => <Bloque key={`${b.anio}-${b.mes}-${b.productoCodigo}`} bloque={b} />)}
    </section>
  )
}
