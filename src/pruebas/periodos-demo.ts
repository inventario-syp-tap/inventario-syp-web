// Datos de demostración para kardex, periodos y saldos iniciales (docs/UI-UX.md §10): productos FIERRO e
// INOXIDABLE, PROVEEDOR DEMO S.A.C. y CLIENTE DEMO S.A.C., cantidades y costos redondos. Nada sale de datos reales.
import type { Alerta, FilaKardex, Kardex, MesKardex } from '@/api/kardex'
import type { EstadoPeriodo, Periodo, PeriodosAnio, SaldoCierreAnual, VistaCierreAnual } from '@/api/periodos'
import type { SaldoInicial } from '@/api/saldos-iniciales'

export function periodoDemo(anio: number, mes: number, estado: EstadoPeriodo = 'ABIERTO', datos: Partial<Periodo> = {}): Periodo {
  return {
    anio, mes, periodo: `${anio}-${String(mes).padStart(2, '0')}`, estado,
    cerradoEn: estado === 'CERRADO' ? `${anio}-${String(mes).padStart(2, '0')}-28T20:00:00.000Z` : null,
    cerradoPor: estado === 'CERRADO' ? 'Contadora (demo)' : null,
    versionCierre: estado === 'CERRADO' ? 1 : null,
    tieneMovimientos: true, movimientos: 4, comprasTn: '30.0000', ventasTn: '25.5000',
    porProducto: [
      { productoId: 1, productoCodigo: 'FIERRO', movimientos: 3, comprasTn: '30.0000', ventasTn: '20.0000' },
      { productoId: 2, productoCodigo: 'INOXIDABLE', movimientos: 1, comprasTn: '0.0000', ventasTn: '5.5000' },
    ],
    libro121: { estado: 'PENDIENTE', impresoEn: null }, asiento: { estado: 'PENDIENTE' },
    libroImpreso: null, asientosExportados: [],
    ...datos,
  }
}

/** Los 12 meses de `anio`; los indicados en `cerrados` quedan CERRADOS y el resto ABIERTOS. */
export function periodosAnioDemo(anio: number, cerrados: readonly number[] = []): PeriodosAnio {
  const meses = Array.from({ length: 12 }, (_, i) => periodoDemo(anio, i + 1, cerrados.includes(i + 1) ? 'CERRADO' : 'ABIERTO'))
  return { anio, meses, anioCompletoCerrado: cerrados.length === 12 }
}

export function filaKardexDemo(datos: Partial<FilaKardex> = {}): FilaKardex {
  return {
    movimientoId: 'mov-1', comprobanteId: 'comp-1', orden: 1, fecha: '2026-03-05', tipoComprobante: '01', serie: 'F001',
    numero: '123', documento: '01-F001-123', tipoOperacion: '02',
    tercero: { tipoDocumento: '6', numeroDocumento: '20000000010', razonSocial: 'PROVEEDOR DEMO S.A.C.' },
    descripcion: 'Chatarra pesada', tipoMovimiento: 'ENTRADA',
    entrada: { cantidad: '30.0000', costoUnitario: '50.000000', costoTotal: '1500.00' }, salida: null,
    saldo: { cantidad: '80.0000', costoUnitario: '56.250000', costoTotal: '4500.00' },
    alertas: [],
    ...datos,
  }
}

/**
 * Kardex de marzo 2026 de FIERRO: SI 50 TN a 60 (3,000.00), compra 30 TN a 50, venta que deja el saldo en -5 TN
 * (stock negativo) y una venta del mismo día que la anterior (para reordenar). Valores ilustrativos de la API.
 */
export function kardexDemo(datos: Partial<Kardex> = {}): Kardex {
  const filas: FilaKardex[] = [
    filaKardexDemo(),
    filaKardexDemo({
      movimientoId: 'mov-2', comprobanteId: 'comp-2', orden: 2, fecha: '2026-03-20', serie: 'E001', numero: '45',
      documento: '01-E001-45', tipoOperacion: '01', tipoMovimiento: 'SALIDA',
      tercero: { tipoDocumento: '6', numeroDocumento: '20000000028', razonSocial: 'CLIENTE DEMO S.A.C.' },
      entrada: null, salida: { cantidad: '85.0000', costoUnitario: '56.250000', costoTotal: '4781.25' },
      saldo: { cantidad: '-5.0000', costoUnitario: '56.250000', costoTotal: '-281.25' }, alertas: ['STOCK_NEGATIVO'],
    }),
    filaKardexDemo({
      movimientoId: 'mov-3', comprobanteId: 'comp-3', orden: 3, fecha: '2026-03-20', serie: 'E001', numero: '46',
      documento: '01-E001-46', tipoOperacion: '01', tipoMovimiento: 'SALIDA',
      tercero: { tipoDocumento: '6', numeroDocumento: '20000000028', razonSocial: 'CLIENTE DEMO S.A.C.' },
      entrada: null, salida: { cantidad: '1234.5', costoUnitario: '56.25', costoTotal: '69440.625' },
      saldo: { cantidad: '-1239.5000', costoUnitario: '56.250000', costoTotal: '-69721.88' }, alertas: ['STOCK_NEGATIVO', 'FECHA_FUERA_DE_ORDEN'],
    }),
  ]
  const marzo: MesKardex = {
    mes: 3, periodo: '2026-03', estado: 'ABIERTO',
    saldoInicial: { cantidad: '50.0000', costoUnitario: '60.000000', costoTotal: '3000.00' },
    entradas: { cantidad: '30.0000', costoTotal: '1500.00' },
    salidas: { cantidad: '1319.5000', costoTotal: '74221.88' },
    saldoFinal: { cantidad: '-1239.5000', costoUnitario: '56.250000', costoTotal: '-69721.88' },
    filas,
  }
  return {
    producto: { id: 1, codigo: 'FIERRO', descripcion: 'Chatarra de fierro' }, establecimientoId: 1, anio: 2026, mes: 3,
    saldoInicialAnio: { id: 4, origen: 'CIERRE_ANUAL', desactualizado: false },
    saldoInicial: marzo.saldoInicial, meses: [marzo], saldoFinal: marzo.saldoFinal,
    ...datos,
  }
}

export function alertaDemo(datos: Partial<Alerta> = {}): Alerta {
  return {
    tipo: 'STOCK_NEGATIVO', anio: 2026, mes: 3, productoId: 1, productoCodigo: 'FIERRO', movimientoId: 'mov-2',
    comprobanteId: 'comp-2', fecha: '2026-03-20', documento: 'E001-0000045', mensaje: 'El saldo queda en -5.0000 TN.',
    ...datos,
  }
}

export function saldoInicialDemo(datos: Partial<SaldoInicial> = {}): SaldoInicial {
  return {
    id: 4, anio: 2026, productoId: 1, productoCodigo: 'FIERRO', establecimientoId: 1, cantidad: '50.0000',
    costoTotal: '3000.00', costoUnitario: '60', origen: 'CIERRE_ANUAL', motivo: null, desactualizado: false, registradoPor: 'Contadora (demo)',
    actualizadoEn: '2026-01-05T15:00:00.000Z',
    ...datos,
  }
}

export function saldoCierreDemo(datos: Partial<SaldoCierreAnual> = {}): SaldoCierreAnual {
  return {
    productoId: 1, productoCodigo: 'FIERRO', establecimientoId: 1,
    saldoFinal: { cantidad: '50.00004', costoTotal: '3000.006' },
    propuesto: { cantidad: '50.0000', costoTotal: '3000.01' },
    existente: { cantidad: '50.0000', costoTotal: '3000.00', id: 4, origen: 'MANUAL', motivo: 'Ajuste demo', desactualizado: true },
    comparacion: 'DIFERENTE', diferencia: { cantidad: '0', costoTotal: '0.01' }, accion: 'REEMPLAZAR',
    ...datos,
  }
}

export function vistaCierreDemo(datos: Partial<VistaCierreAnual> = {}): VistaCierreAnual {
  return {
    anio: 2025, anioSiguiente: 2026, mesesAbiertos: [], requiereConfirmacion: true,
    saldos: [
      saldoCierreDemo(),
      saldoCierreDemo({
        productoId: 2, productoCodigo: 'INOXIDABLE', existente: null, comparacion: 'INEXISTENTE', diferencia: null, accion: 'CREAR',
        saldoFinal: { cantidad: '10', costoTotal: '1000' }, propuesto: { cantidad: '10.0000', costoTotal: '1000.00' },
      }),
    ],
    ...datos,
  }
}
