// Resultado de GET /importacion/paridad. Códigos de producto y detalle se muestran tal como vienen de la API;
// la diferencia máxima puede llegar en notación científica (2.58e-10) y se muestra con 6 decimales,
// como la tolerancia, más el valor exacto: "0.000000 (2.58 × 10⁻¹⁰)".
// Cada comparación tiene dos caminos: lo guardado en la base (BD) y lo que recalcula el motor al leer.
import { CircleCheckIcon, CircleXIcon } from 'lucide-react'
import type { FilaParidad, Paridad } from '@/api/importacion'
import { Aviso } from '@/componentes/comunes/aviso'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/componentes/ui/table'
import { formatearDiferencia, formatearEntero, leerDiferencia } from '@/lib/formato'

type Conteo = { diferencias: number }

const diferenciasDe = (fila: FilaParidad) =>
  [fila.kardex, fila.resumen, fila.libro].reduce((suma, c) => suma + c.guardado.diferencias + c.motor.diferencias, 0)

const BdMotor = ({ bd, motor }: { bd: number; motor: number }) => (
  <>{formatearEntero(bd)} / {formatearEntero(motor)}</>
)

function Estado({ diferencias }: { diferencias: number }) {
  if (diferencias === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <CircleCheckIcon aria-hidden="true" className="size-4" /> Coincide
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-destructive">
      <CircleXIcon aria-hidden="true" className="size-4" /> {formatearEntero(diferencias)} con diferencia
    </span>
  )
}

// Lo visible (con superíndices) se oculta a los lectores de pantalla, que leen la versión en palabras.
function Diferencia({ valor }: { valor: string }) {
  const visible = formatearDiferencia(valor)
  const hablado = leerDiferencia(valor)
  if (visible === hablado) return <span className="font-mono tabular-nums">{visible}</span>
  return (
    <span className="font-mono tabular-nums">
      <span aria-hidden="true">{visible}</span>
      <span className="sr-only">{hablado}</span>
    </span>
  )
}

const NUM = 'text-right tabular-nums'
const dif = ({ guardado, motor }: { guardado: Conteo; motor: Conteo }) => (
  <BdMotor bd={guardado.diferencias} motor={motor.diferencias} />
)

export function TablaParidad({ paridad }: { paridad: Paridad }) {
  const alertas = Object.entries(paridad.alertas)

  return (
    <div className="flex flex-col gap-4">
      {paridad.totalDiferencias === 0 ? (
        <Aviso tono="exito" titulo="Paridad completa: 0 diferencias">
          Kardex, resumen mensual, libro 12.1 y asientos coinciden con los resultados de referencia.
        </Aviso>
      ) : (
        <div role="alert" className="flex gap-3 rounded-md border border-destructive p-3 text-sm">
          <CircleXIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="font-medium text-destructive">
            Se encontraron {formatearEntero(paridad.totalDiferencias)} diferencias. El detalle está debajo de la tabla.
          </p>
        </div>
      )}

      <Table>
        <TableCaption>
          Paridad por año y producto. Diferencias: valores guardados en la base (BD) / recalculados por el motor.
          En el libro 12.1 las diferencias conocidas y explicadas cuentan como comparadas; solo las nuevas o
          resueltas son diferencias.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Año · Producto</TableHead>
            <TableHead scope="col" className="text-right">Kardex: filas</TableHead>
            <TableHead scope="col" className="text-right">Kardex: diferencias (BD / motor)</TableHead>
            <TableHead scope="col" className="text-right">Resumen mensual: filas</TableHead>
            <TableHead scope="col" className="text-right">Resumen mensual: diferencias (BD / motor)</TableHead>
            <TableHead scope="col" className="text-right">Libro 12.1: filas</TableHead>
            <TableHead scope="col" className="text-right">Libro 12.1: nuevas (BD / motor)</TableHead>
            <TableHead scope="col" className="text-right">Libro 12.1: resueltas (BD / motor)</TableHead>
            <TableHead scope="col">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paridad.filas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No hay datos para comparar. Carga primero el histórico.
              </TableCell>
            </TableRow>
          ) : (
            paridad.filas.map((fila) => (
              <TableRow key={`${fila.anio}-${fila.productoCodigo}`}>
                <TableHead scope="row" className="font-normal">
                  {fila.anio} · <span className="font-mono">{fila.productoCodigo}</span>
                </TableHead>
                <TableCell className={NUM}>{formatearEntero(fila.kardex.guardado.comparados)}</TableCell>
                <TableCell className={NUM}>{dif(fila.kardex)}</TableCell>
                <TableCell className={NUM}>{formatearEntero(fila.resumen.guardado.comparados)}</TableCell>
                <TableCell className={NUM}>{dif(fila.resumen)}</TableCell>
                <TableCell className={NUM}>{formatearEntero(fila.libro.guardado.comparados)}</TableCell>
                <TableCell className={NUM}>
                  <BdMotor bd={fila.libro.guardado.nuevas} motor={fila.libro.motor.nuevas} />
                </TableCell>
                <TableCell className={NUM}>
                  <BdMotor bd={fila.libro.guardado.resueltas} motor={fila.libro.motor.resueltas} />
                </TableCell>
                <TableCell><Estado diferencias={diferenciasDe(fila)} /></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <section aria-labelledby="titulo-resumen-paridad" className="flex flex-col gap-2 text-sm">
        <h3 id="titulo-resumen-paridad" className="font-medium">Resumen</h3>
        <ul className="flex flex-col gap-1">
          {paridad.asientos.map((fila) => {
            const diferencias = fila.asientos.guardado.diferencias + fila.asientos.motor.diferencias
            return (
              <li key={fila.anio} className="flex flex-wrap items-center gap-2">
                <span>
                  Asientos {fila.anio}: {formatearEntero(fila.asientos.guardado.comparados)} comparados, diferencias{' '}
                  <BdMotor bd={fila.asientos.guardado.diferencias} motor={fila.asientos.motor.diferencias} />
                </span>
                <Estado diferencias={diferencias} />
              </li>
            )
          })}
          <li>
            Diferencia máxima (tolerancia 0.000001): BD{' '}
            <Diferencia valor={paridad.maxima.guardado} />{' '}
            · motor <Diferencia valor={paridad.maxima.motor} />
          </li>
          <li>
            Alertas del kardex:{' '}
            {alertas.length === 0
              ? 'ninguna'
              : alertas.map(([codigo, cantidad], i) => (
                <span key={codigo}>
                  {i > 0 && ', '}
                  <span className="font-mono">{codigo}</span> {formatearEntero(cantidad)}
                </span>
              ))}
          </li>
        </ul>
      </section>

      {paridad.detalle.length > 0 && (
        <section aria-labelledby="titulo-detalle-paridad" className="flex flex-col gap-2 text-sm">
          <h3 id="titulo-detalle-paridad" className="font-medium">Detalle de las diferencias</h3>
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border p-3 font-mono text-xs">
            {paridad.detalle.map((linea, i) => (
              <li key={i}>{linea}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
