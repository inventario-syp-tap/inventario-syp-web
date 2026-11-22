// Un tipo de asiento del mes (docs/UI-UX.md §5.13): glosa, estado de la exportación, tabla Cuenta · Debe · Haber con
// los importes a 2 decimales que se exportan (el exacto en tooltip), totales, «Reglas aplicadas» desplegable, los
// movimientos sin regla contable ("falta regla contable": bloquean solo la exportación de ESTE tipo) y, si no se
// puede exportar, el motivo que manda la API. Todo viene calculado: la web no suma ni redondea.
import { Link } from 'react-router'
import { CircleCheckIcon, FileSpreadsheetIcon, TriangleAlertIcon } from 'lucide-react'
import Big from 'big.js'
import { textoMotivoNoExportable } from './mensajes'
import { NOMBRE_TIPO_ASIENTO, type Asiento, type LineaAsiento } from '@/api/asientos'
import { RAIZ_MODULO } from '@/app/paginas'
import { Aviso } from '@/componentes/comunes/aviso'
import { Cifra } from '@/componentes/comunes/cifra'
import { EstadoAsiento } from '@/componentes/comunes/estado-asiento'
import { Button } from '@/componentes/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/componentes/ui/tooltip'
import { formatearDecimal, formatearFecha, formatearToneladas } from '@/lib/formato'

type Props = {
  asiento: Asiento
  /** Mes y año en palabras ("Enero 2026"), para los textos. */
  periodo: string
  /** El rol puede exportar (A, C): sin permiso, el botón no se muestra. */
  puedeExportar: boolean
  alExportar: (origen: HTMLElement) => void
}

/** Importe a 2 decimales (el que se exporta) con el exacto en un tooltip que también se abre con el teclado. */
function Importe({ valor, exacto }: { valor: string; exacto: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
            <Cifra tipo="importe" valor={valor} />
          </span>
        </TooltipTrigger>
        <TooltipContent>Importe exacto: <span className="tabular-nums">{formatearDecimal(exacto, 10)}</span></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const ImporteLinea = ({ linea }: { linea: LineaAsiento }) => <Importe valor={linea.redondeado} exacto={linea.exacto} />

/** true si Debe y Haber son iguales (solo se comparan; los totales los calcula la API). */
function cuadra(asiento: Asiento): boolean {
  try {
    return new Big(asiento.totalDebe).eq(new Big(asiento.totalHaber))
  } catch {
    return false
  }
}

export function SeccionAsiento({ asiento, periodo, puedeExportar, alExportar }: Props) {
  const nombre = NOMBRE_TIPO_ASIENTO[asiento.tipoAsiento]
  const idTitulo = `asiento-${asiento.tipoAsiento}`
  const idMotivo = `motivo-${asiento.tipoAsiento}`
  const motivo = asiento.exportable ? null : textoMotivoNoExportable(asiento.motivoNoExportable, periodo)
  const sinLineas = asiento.lineas.length === 0
  const ok = cuadra(asiento)

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3 rounded-md border p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={idTitulo} className="text-base font-semibold">{nombre}</h2>
          <p className="text-sm font-medium">{asiento.glosa}</p>
          <p className="text-xs text-muted-foreground">
            Comprobante <span className="font-mono">{asiento.numeroComprobante}</span>
          </p>
          <p className="inline-flex flex-wrap items-center gap-1 text-sm">
            Exportación: <EstadoAsiento estado={asiento.exportacion.estado} numeroAsiento={asiento.exportacion.numeroAsiento}
              exportadoEn={asiento.exportacion.exportadoEn} />
          </p>
        </div>
        {puedeExportar && (
          <Button type="button" disabled={!asiento.exportable} aria-describedby={motivo ? idMotivo : undefined}
            aria-label={`Exportar a WinConta el asiento de ${nombre.toLowerCase()} de ${periodo}`}
            onClick={(e) => alExportar(e.currentTarget)}>
            <FileSpreadsheetIcon aria-hidden="true" />
            Exportar a WinConta
          </Button>
        )}
      </header>

      {motivo && (
        <p id={idMotivo} className="inline-flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            {motivo}
            {asiento.motivoNoExportable === 'PERIODO_NO_CERRADO' && (
              <> <Link className="text-foreground underline underline-offset-2" to={`${RAIZ_MODULO}/periodos`}>Ir a Periodos</Link></>
            )}
          </span>
        </p>
      )}

      {sinLineas ? (
        <p className="text-sm text-muted-foreground">Sin líneas de {nombre.toLowerCase()} en {periodo}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <caption className="sr-only">Asiento de {nombre.toLowerCase()} de {periodo}: cuentas, Debe y Haber en soles</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="px-2 py-1.5 font-medium">Cuenta</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Debe S/</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Haber S/</th>
              </tr>
            </thead>
            <tbody>
              {asiento.lineas.map((l, i) => (
                <tr key={`${l.cuenta}-${l.lado}-${i}`} className="border-b">
                  <th scope="row" className="px-2 py-1.5 text-left font-mono font-normal">{l.cuenta}</th>
                  <td className="px-2 py-1.5 text-right">{l.lado === 'D' && <ImporteLinea linea={l} />}</td>
                  <td className="px-2 py-1.5 text-right">{l.lado === 'H' && <ImporteLinea linea={l} />}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted font-semibold">
                <th scope="row" className="px-2 py-1.5 text-left">Totales</th>
                <td className="px-2 py-1.5 text-right"><Cifra tipo="importe" valor={asiento.totalDebe} /></td>
                <td className="px-2 py-1.5 text-right"><Cifra tipo="importe" valor={asiento.totalHaber} /></td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-1 inline-flex items-center gap-1 text-xs">
            {ok ? (
              <><CircleCheckIcon aria-hidden="true" className="size-3.5 text-success" /> Cuadra: Debe y Haber son iguales.</>
            ) : (
              <><TriangleAlertIcon aria-hidden="true" className="size-3.5 text-warning" /> No cuadra: Debe y Haber son distintos.</>
            )}
          </p>
        </div>
      )}

      {asiento.reglas.length > 0 && (
        <details className="text-sm">
          <summary className="w-fit cursor-pointer rounded-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
            Reglas aplicadas ({asiento.reglas.length})
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-xs">
              <caption className="sr-only">Reglas contables aplicadas al asiento de {nombre.toLowerCase()}</caption>
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="px-2 py-1 font-medium">Regla</th>
                  <th scope="col" className="px-2 py-1 font-medium">Producto</th>
                  <th scope="col" className="px-2 py-1 font-medium">Op.</th>
                  <th scope="col" className="px-2 py-1 font-medium">Cuenta Debe</th>
                  <th scope="col" className="px-2 py-1 font-medium">Cuenta Haber</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Importe S/</th>
                </tr>
              </thead>
              <tbody>
                {asiento.reglas.map((r) => (
                  <tr key={`${r.codigo}-${r.productoCodigo}-${r.tipoOperacion}`} className="border-b">
                    <td className="px-2 py-1 font-mono">{r.codigo}</td>
                    <td className="px-2 py-1">{r.productoCodigo}</td>
                    <td className="px-2 py-1 font-mono">{r.tipoOperacion}</td>
                    <td className="px-2 py-1 font-mono">{r.cuentaDebe}</td>
                    <td className="px-2 py-1 font-mono">{r.cuentaHaber}</td>
                    <td className="px-2 py-1 text-right"><Importe valor={r.importe} exacto={r.importe} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {asiento.faltantes.length > 0 ? (
        <Aviso tono="advertencia" titulo={`Falta regla contable: ${asiento.faltantes.length} ${asiento.faltantes.length === 1 ? 'movimiento' : 'movimientos'} sin regla`}
          acciones={(
            <Link className="text-sm text-foreground underline underline-offset-2" to={`${RAIZ_MODULO}/maestros/reglas-contables`}>
              Configurar reglas contables
            </Link>
          )}>
          <p>Solo se bloquea la exportación de {nombre.toLowerCase()}; los demás tipos se exportan normalmente.</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-foreground">
            {asiento.faltantes.map((f) => (
              <li key={f.movimientoId}>
                {formatearFecha(f.fecha)} · <span className="font-mono">{f.documento}</span> · {f.productoCodigo} · op.{' '}
                <span className="font-mono">{f.tipoOperacion}</span> · {f.tipoMovimiento === 'ENTRADA' ? 'entrada' : 'salida'}{' '}
                <span className="tabular-nums">{formatearToneladas(f.cantidad)}</span> TN
                {f.costo !== null && <> · S/ <span className="tabular-nums">{formatearDecimal(f.costo, 2)}</span></>}
              </li>
            ))}
          </ul>
        </Aviso>
      ) : !sinLineas && (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CircleCheckIcon aria-hidden="true" className="size-3.5 text-success" />
          Todos los movimientos tienen regla contable.
        </p>
      )}
    </section>
  )
}
