// Detalle de un comprobante (docs/UI-UX.md §5.7): cabecera y sus líneas con el EFECTO EN EL KARDEX tal como lo
// calculó la API (orden, costo de la entrada o de la salida y saldo después del movimiento). Aquí no se calcula nada.
import { BanIcon } from 'lucide-react'
import { documentoComprobante, formatearImporte, nombreOperacion, nombreTipoComprobante } from './esquemas'
import type { Comprobante } from '@/api/comprobantes'
import { Cifra } from '@/componentes/comunes/cifra'
import { IconoAlerta } from '@/componentes/comunes/icono-alerta'
import { textoDocumento } from '@/funcionalidades/maestros/terceros/esquemas'
import { formatearFecha, formatearFechaHora, formatearTipoCambio } from '@/lib/formato'

export function EstadoComprobante({ comprobante }: { comprobante: Pick<Comprobante, 'estado' | 'motivoAnulacion'> }) {
  if (comprobante.estado === 'REGISTRADO') return <span>Registrado</span>
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground" title={comprobante.motivoAnulacion ?? undefined}>
      <BanIcon aria-hidden="true" className="size-3.5" />
      Anulado
      {comprobante.motivoAnulacion && <span className="sr-only">. Motivo: {comprobante.motivoAnulacion}</span>}
    </span>
  )
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{termino}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

export function DetalleComprobante({ comprobante: c }: { comprobante: Comprobante }) {
  const esVenta = c.naturaleza === 'VENTA'
  const referencias = [c.guiaRemision && `Guía ${c.guiaRemision}`, c.ticketBalanza && `Ticket ${c.ticketBalanza}`, c.placaVehiculo && `Placa ${c.placaVehiculo}`]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex flex-col gap-4">
      {c.estado === 'ANULADO' && (
        <p role="note" className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm">
          <BanIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Anulado{c.anuladoEn ? ` el ${formatearFechaHora(c.anuladoEn)}` : ''}. Motivo: {c.motivoAnulacion ?? '—'}
          </span>
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato termino="Operación">{nombreOperacion(c)} ({c.tipoOperacion})</Dato>
        <Dato termino="Comprobante">
          {nombreTipoComprobante(c.tipoComprobante)} <span className="font-mono">{documentoComprobante(c)}</span>
        </Dato>
        <Dato termino="Fecha de emisión"><span className="tabular-nums">{formatearFecha(c.fecha)}</span></Dato>
        <Dato termino="Estado"><EstadoComprobante comprobante={c} /></Dato>
        {c.tercero && (
          <Dato termino={c.naturaleza === 'COMPRA' ? 'Proveedor' : 'Cliente'}>
            <span className="font-mono text-xs">{textoDocumento(c.tercero)}</span> {c.tercero.razonSocial}
          </Dato>
        )}
        {esVenta && (
          <Dato termino="Moneda">{c.moneda}{c.tipoCambio ? ` · tipo de cambio ${formatearTipoCambio(c.tipoCambio)}` : ''}</Dato>
        )}
        {c.sustento && <Dato termino="Sustento">{c.sustento}</Dato>}
        {referencias && <Dato termino="Referencias">{referencias}</Dato>}
        {c.observacion && <Dato termino="Observación">{c.observacion}</Dato>}
        {c.origenImportacion && <Dato termino="Origen">Carga histórica ({c.origenImportacion})</Dato>}
      </dl>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[60rem] text-sm">
          <caption className="p-2 text-left text-sm font-medium">Líneas y efecto en el kardex</caption>
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="p-2 text-right">Orden</th>
              <th scope="col" className="p-2 text-left">Producto</th>
              <th scope="col" className="p-2 text-left">Descripción</th>
              <th scope="col" className="p-2 text-left">Movimiento</th>
              <th scope="col" className="p-2 text-right">Cantidad TN</th>
              {esVenta && <th scope="col" className="p-2 text-right">Valor venta x TN</th>}
              <th scope="col" className="p-2 text-right">CU S/</th>
              <th scope="col" className="p-2 text-right">Costo total S/</th>
              <th scope="col" className="p-2 text-right">Saldo TN</th>
              <th scope="col" className="p-2 text-right">Saldo CU S/</th>
              <th scope="col" className="p-2 text-right">Saldo S/</th>
              <th scope="col" className="p-2 text-left">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {c.lineas.map((l) => {
              const entrada = l.tipoMovimiento === 'ENTRADA'
              return (
                <tr key={l.id} className="border-t">
                  <td className="p-2 text-right tabular-nums">{l.orden}</td>
                  <td className="p-2 font-mono text-xs">{l.productoCodigo}</td>
                  <td className="p-2">{l.descripcion}</td>
                  <td className="p-2">{entrada ? 'Entrada' : 'Salida'}{l.costoAlPromedio ? ' (al promedio)' : ''}</td>
                  <td className="p-2 text-right"><Cifra tipo="toneladas" valor={l.cantidad} /></td>
                  {esVenta && <td className="p-2 text-right tabular-nums">{formatearImporte(l.valorVentaUnitario, c.moneda)}</td>}
                  <td className="p-2 text-right"><Cifra tipo="cu" valor={entrada ? l.costoUnitario : l.costoUnitarioSalida} /></td>
                  <td className="p-2 text-right"><Cifra tipo="soles" valor={entrada ? l.costoTotalEntrada : l.costoTotalSalida} /></td>
                  <td className="p-2 text-right"><Cifra tipo="toneladas" valor={l.saldoCantidad} /></td>
                  <td className="p-2 text-right"><Cifra tipo="cu" valor={l.saldoCostoUnitario} /></td>
                  <td className="p-2 text-right"><Cifra tipo="soles" valor={l.saldoCostoTotal} /></td>
                  <td className="p-2">
                    {l.alertas.length === 0 ? <span className="text-muted-foreground">—</span> : (
                      <span className="flex flex-col gap-1">{l.alertas.map((a) => <IconoAlerta key={a} codigo={a} />)}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Saldo después de cada movimiento, en el kardex de su producto y establecimiento ({c.lineas[0]?.anio ?? '—'}).
      </p>
    </div>
  )
}
