// Historial de exportaciones a WinConta del año (GET /asientos/exportados?anio): mes, tipo, n.º de asiento, tipo de
// cambio, total, quién y cuándo, y el estado con ícono y texto: ✓ Vigente · ⚠ Desactualizado (el asiento cambió
// después de exportarlo: vuelve a exportar) · Reemplazada (hubo una exportación posterior del mismo mes y tipo).
import { useMemo } from 'react'
import { CircleCheckIcon, HistoryIcon, TriangleAlertIcon } from 'lucide-react'
import { NOMBRE_TIPO_ASIENTO, useAsientosExportados, type AsientoExportado } from '@/api/asientos'
import { Cifra } from '@/componentes/comunes/cifra'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { mensajeDeError } from '@/lib/errores'
import { formatearFechaHora, formatearPeriodo, formatearTipoCambio } from '@/lib/formato'

export function EstadoExportado({ exportacion: e }: { exportacion: Pick<AsientoExportado, 'vigente' | 'desactualizado'> }) {
  if (!e.vigente) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <HistoryIcon aria-hidden="true" className="size-3.5 shrink-0" />
        Reemplazada
      </span>
    )
  }
  if (e.desactualizado) {
    return (
      <span className="inline-flex items-center gap-1">
        <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
        Desactualizado: vuelve a exportar
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <CircleCheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-success" />
      Vigente
    </span>
  )
}

export function HistorialExportaciones({ anio }: { anio: number }) {
  const exportados = useAsientosExportados(anio)

  const columnas = useMemo<ColumnaTabla<AsientoExportado>[]>(() => [
    // Se ordena por AAAA-MM (cronológico) y se muestra "Enero 2026".
    { id: 'mes', encabezado: 'Mes', valor: (e) => `${e.anio}-${String(e.mes).padStart(2, '0')}`, celda: (e) => formatearPeriodo(e.anio, e.mes) },
    { id: 'tipo', encabezado: 'Tipo', valor: (e) => NOMBRE_TIPO_ASIENTO[e.tipoAsiento] },
    { id: 'numero', encabezado: 'N.° asiento', celda: (e) => <span className="font-mono">{e.numeroAsiento}</span>, valor: (e) => e.numeroAsiento },
    { id: 'tc', encabezado: 'T.C.', numerica: true, celda: (e) => <span className="tabular-nums">{formatearTipoCambio(e.tipoCambio)}</span> },
    { id: 'total', encabezado: 'Total Debe S/', numerica: true, celda: (e) => <Cifra tipo="importe" valor={e.totalDebe} /> },
    {
      id: 'exportado',
      encabezado: 'Exportado',
      celda: (e) => (
        <span className="flex flex-col text-xs">
          <span>{formatearFechaHora(e.exportadoEn)}{e.exportadoPor ? ` · ${e.exportadoPor}` : ''}</span>
          <span className="text-muted-foreground">{e.archivoNombre}</span>
        </span>
      ),
    },
    { id: 'estado', encabezado: 'Estado', celda: (e) => <EstadoExportado exportacion={e} /> },
  ], [])

  return (
    <section aria-labelledby="titulo-historial" className="flex flex-col gap-2">
      <h2 id="titulo-historial" className="text-base font-semibold">Historial de exportaciones de {anio}</h2>
      {exportados.isError ? (
        <EstadoError mensaje={mensajeDeError(exportados.error)} alReintentar={() => void exportados.refetch()} />
      ) : (
        <TablaDatos
          titulo={`Exportaciones a WinConta de ${anio}`}
          columnas={columnas}
          datos={exportados.data?.exportaciones}
          idFila={(e) => String(e.id)}
          cargando={exportados.isPending}
          filaAtenuada={(e) => !e.vigente}
          vacio={`Aún no hay asientos exportados a WinConta en ${anio}.`}
        />
      )}
    </section>
  )
}
