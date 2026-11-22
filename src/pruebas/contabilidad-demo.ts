// Datos de demostración para asientos, control de tonelaje y toma de inventario (docs/UI-UX.md §10): productos
// FIERRO e INOXIDABLE, cuentas y cifras redondas e ilustrativas, n.º de asiento 0001 y tipo de cambio 3.750.
// Nada sale de datos reales.
import type { Asiento, AsientoExportado, AsientosExportados, AsientosMes } from '@/api/asientos'
import type { ControlTonelaje, MesTonelaje, ReporteTonelaje } from '@/api/control-tonelaje'
import type { LineaToma, Toma } from '@/api/tomas-inventario'

export function asientoDemo(datos: Partial<Asiento> = {}): Asiento {
  return {
    tipoAsiento: 'COSTO_VENTAS',
    glosa: 'PROVISION COSTO DE VENTAS ENERO 2026',
    numeroComprobante: 'CV012026',
    lineas: [
      { cuenta: '691101', lado: 'D', exacto: '600.0000000000', redondeado: '600.00' },
      { cuenta: '201101', lado: 'H', exacto: '600.0000000000', redondeado: '600.00' },
    ],
    reglas: [
      { codigo: 'RD-01', productoCodigo: 'FIERRO', tipoOperacion: '01', cuentaDebe: '691101', cuentaHaber: '201101', importe: '600.0000000000' },
    ],
    faltantes: [],
    totalDebe: '600.00',
    totalHaber: '600.00',
    exportable: true,
    motivoNoExportable: null,
    exportacion: { estado: 'PENDIENTE', numeroAsiento: null, exportadoEn: null },
    ...datos,
  }
}

const vacio = (tipoAsiento: Asiento['tipoAsiento'], glosa: string): Asiento => asientoDemo({
  tipoAsiento, glosa, numeroComprobante: 'XX012026', lineas: [], reglas: [], totalDebe: '0.00', totalHaber: '0.00',
  exportable: false, motivoNoExportable: 'ASIENTO_VACIO',
})

/**
 * Enero 2026 CERRADO: costo de ventas exportable; merma con 1 línea; desmedro con un movimiento sin regla
 * (falta regla contable); ajuste faltante con líneas y ajuste sobrante vacío.
 */
export function asientosMesDemo(datos: Partial<AsientosMes> = {}): AsientosMes {
  return {
    anio: 2026, mes: 1, periodo: '2026-01', estadoMes: 'CERRADO',
    asientos: [
      asientoDemo(),
      asientoDemo({
        tipoAsiento: 'MERMA', glosa: 'MERMA ENERO 2026', numeroComprobante: 'ME012026',
        lineas: [
          { cuenta: '659501', lado: 'D', exacto: '100.0000000000', redondeado: '100.00' },
          { cuenta: '201101', lado: 'H', exacto: '100.0000000000', redondeado: '100.00' },
        ],
        reglas: [{ codigo: 'RD-02', productoCodigo: 'FIERRO', tipoOperacion: '13', cuentaDebe: '659501', cuentaHaber: '201101', importe: '100.0000000000' }],
        totalDebe: '100.00', totalHaber: '100.00',
      }),
      asientoDemo({
        tipoAsiento: 'DESMEDRO', glosa: 'DESMEDRO ENERO 2026', numeroComprobante: 'DE012026', lineas: [], reglas: [],
        faltantes: [{
          movimientoId: 'mov-9', fecha: '2026-01-20', productoCodigo: 'INOXIDABLE', tipoOperacion: '14', tipoMovimiento: 'SALIDA',
          documento: '00-AD-0001', cantidad: '0.5000', costo: '50.0000000000',
        }],
        totalDebe: '0.00', totalHaber: '0.00', exportable: false, motivoNoExportable: 'REGLA_CONTABLE_FALTANTE',
      }),
      asientoDemo({
        tipoAsiento: 'AJUSTE_FALTANTE', glosa: 'AJUSTE FALTANTE ENERO 2026', numeroComprobante: 'AF012026',
        lineas: [
          { cuenta: '659502', lado: 'D', exacto: '25.0000000000', redondeado: '25.00' },
          { cuenta: '201101', lado: 'H', exacto: '25.0000000000', redondeado: '25.00' },
        ],
        reglas: [], totalDebe: '25.00', totalHaber: '25.00',
      }),
      vacio('AJUSTE_SOBRANTE', 'AJUSTE SOBRANTE ENERO 2026'),
    ],
    ...datos,
  }
}

export function exportadoDemo(datos: Partial<AsientoExportado> = {}): AsientoExportado {
  return {
    id: 1, anio: 2026, mes: 1, periodo: '2026-01', tipoAsiento: 'COSTO_VENTAS', numeroAsiento: '0001', tipoCambio: '3.750',
    totalDebe: '600.00', archivoNombre: 'winconta_costo-ventas_2026-01.xlsx', exportadoEn: '2026-02-10T15:00:00.000Z',
    exportadoPor: 'Contadora (demo)', vigente: true, desactualizado: false,
    ...datos,
  }
}

export function exportadosDemo(exportaciones: AsientoExportado[] = []): AsientosExportados {
  return { anio: 2026, exportaciones }
}

export function reporteTonelajeDemo(datos: Partial<ReporteTonelaje> = {}): ReporteTonelaje {
  return {
    id: 1, fuente: 'REPORTE EXTERNO', toneladasReportadas: '30.0000', diferencia: '0.0000', hayDiferencia: false,
    nota: null, observacion: null,
    ...datos,
  }
}

/** Enero sin diferencia, febrero con diferencia de 2 TN y observación; el resto sin reporte. */
export function controlTonelajeDemo(datos: Partial<ControlTonelaje> = {}): ControlTonelaje {
  const meses: MesTonelaje[] = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1, periodo: `2026-${String(i + 1).padStart(2, '0')}`, comprasKardex: i < 2 ? '30.0000' : '0.0000',
    reportes: [], hayDiferencia: false,
  }))
  meses[0].reportes = [reporteTonelajeDemo()]
  meses[1].reportes = [reporteTonelajeDemo({
    id: 2, toneladasReportadas: '32.0000', diferencia: '2.0000', hayDiferencia: true, observacion: 'Compra registrada al mes siguiente',
  })]
  meses[1].hayDiferencia = true
  return { anio: 2026, meses, mesesConDiferencia: 1, ...datos }
}

export function lineaTomaDemo(datos: Partial<LineaToma> = {}): LineaToma {
  return {
    productoId: 1, productoCodigo: 'FIERRO', productoDescripcion: 'CHATARRA DE FIERRO DEMO', cantidadSistema: '15.0000',
    cantidadContada: '14.7500', diferencia: '-0.2500', tipoDiferencia: 'FALTANTE', dentroDeTolerancia: false, accion: null,
    comprobante: null, observacion: null,
    ...datos,
  }
}

/** Toma del 31/03/2026 en BORRADOR: FIERRO faltante, INOXIDABLE sobrante y COBRE sin diferencia. */
export function tomaDemo(datos: Partial<Toma> = {}): Toma {
  return {
    id: 'toma-1', fecha: '2026-03-31', establecimientoId: 1, estado: 'BORRADOR', resuelta: false,
    responsable: 'Contadora (demo)', observacion: null, creadoPor: 'Contadora (demo)', creadoEn: '2026-03-31T20:00:00.000Z',
    lineas: [
      lineaTomaDemo(),
      lineaTomaDemo({
        productoId: 2, productoCodigo: 'INOXIDABLE', productoDescripcion: 'CHATARRA INOXIDABLE DEMO', cantidadSistema: '10.0000',
        cantidadContada: '10.5000', diferencia: '0.5000', tipoDiferencia: 'SOBRANTE',
      }),
      lineaTomaDemo({
        productoId: 3, productoCodigo: 'COBRE', productoDescripcion: 'CHATARRA DE COBRE DEMO', cantidadSistema: '2.5000',
        cantidadContada: '2.5000', diferencia: '0.0000', tipoDiferencia: 'SIN_DIFERENCIA',
      }),
    ],
    comprobantes: [],
    ...datos,
  }
}
