// Datos de demostración para libros 12.1/13.1 y reportes (docs/UI-UX.md §10): EMPRESA DEMO S.A.C. (RUC 20000000001),
// LOCAL DEMO, productos FIERRO e INOXIDABLE y cifras redondas. Nada sale de datos reales.
import type { BloqueLibro121, ImpresionesLibro121, Libro121 } from '@/api/libros'
import type { CostoVentas, CostoVentasMes, Margen, MargenMes, ResumenAnual, ResumenAnualFila, Toneladas, ToneladasMes } from '@/api/reportes'

export function bloque121Demo(datos: Partial<BloqueLibro121> = {}): BloqueLibro121 {
  return {
    anio: 2026, mes: 1, productoCodigo: 'FIERRO',
    cabecera: {
      periodo: 'ENERO--2026', ruc: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.', establecimiento: '0001-LOCAL DEMO',
      codigoExistencia: 'CH FIERRO', tipoExistencia: '01-MERCADERIA', descripcion: 'CHATARRA DE FIERRO DEMO', unidadMedida: 'TNE',
    },
    saldoInicial: { entrada: '12.500', saldo: '12.50' },
    filas: [
      { fecha: '05/01/2026', tipoT10: '01', serie: 'F001', numero: '0000123', tipoOperacionT12: '02', entrada: '12.500', salida: '', saldo: '25.00' },
      { fecha: '20/01/2026', tipoT10: '01', serie: 'E001', numero: '0000045', tipoOperacionT12: '01', entrada: '', salida: '10.000', saldo: '15.00' },
    ],
    saldoFinal: '15.00',
    totales: { entradas: '25.00', salidas: '10.00' },
    estadoMes: 'CERRADO', borrador: false,
    ...datos,
  }
}

export function libro121Demo(datos: Partial<Libro121> = {}): Libro121 {
  return { anio: 2026, mes: 1, modo: 'AGRUPADO', bloques: [bloque121Demo()], borrador: false, ...datos }
}

export function impresionesDemo(datos: Partial<ImpresionesLibro121> = {}): ImpresionesLibro121 {
  return {
    impresiones: [],
    meses: Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1, periodo: `2026-${String(i + 1).padStart(2, '0')}`, estado: 'PENDIENTE' as const, impresoEn: null,
    })),
    ...datos,
  }
}

const tn = (mes: number | null, datos: Partial<ToneladasMes> = {}): ToneladasMes => ({
  mes, saldoInicial: '10.0000', compras: '20.0000', otrasEntradas: '0', ventas: '15.0000', mermas: '0', desmedros: '0',
  otrasSalidas: '0', saldoFinal: '15.0000', ...datos,
})

export function toneladasDemo(): Toneladas {
  return {
    anio: 2026,
    productos: [{
      productoId: 1, productoCodigo: 'FIERRO', descripcion: 'CHATARRA DE FIERRO',
      meses: [tn(1), tn(2, { saldoInicial: '15.0000', saldoFinal: '20.0000' })],
      total: tn(null, { compras: '40.0000', ventas: '30.0000', saldoFinal: '20.0000' }),
    }],
    enToneladas: { meses: [tn(1), tn(2)], total: tn(null, { compras: '40.0000', ventas: '30.0000', saldoFinal: '20.0000' }) },
  }
}

const cv = (mes: number | null, datos: Partial<CostoVentasMes> = {}): CostoVentasMes => ({
  mes, saldoInicial: '10800', compras: '21600', otrasEntradas: '0', saldoFinal: '16200', mermas: '540', desmedros: '0',
  otrasSalidas: '0', costoVentas: '15660', totalSalidasValorizadas: '16200', ...datos,
})

export function costoVentasDemo(): CostoVentas {
  return {
    anio: 2026,
    productos: [{ productoId: 1, productoCodigo: 'FIERRO', descripcion: 'CHATARRA DE FIERRO', meses: [cv(1)], total: cv(null, { costoVentas: '31320', totalSalidasValorizadas: '32400' }) }],
    resumen: { meses: [cv(1)], total: cv(null, { costoVentas: '31320', totalSalidasValorizadas: '32400' }) },
  }
}

const fila = (base: string): ResumenAnualFila => ({
  inventarioInicial: { cantidad: '10.0000', costo: base },
  compras: { cantidad: '40.0000', costo: '43200' },
  otrasEntradas: { cantidad: '0', costo: '0' },
  inventarioFinal: { cantidad: '20.0000', costo: '21600' },
  costoVentas: { cantidad: '29.0000', costo: '31320' },
  mermas: { cantidad: '1.0000', costo: '1080' },
  desmedros: { cantidad: '0', costo: '0' },
  otrasSalidas: { cantidad: '0', costo: '0' },
  totalSalidasValorizadas: '32400',
})

export function resumenAnualDemo(): ResumenAnual {
  return {
    anio: 2026,
    productos: [{ productoId: 1, productoCodigo: 'FIERRO', descripcion: 'CHATARRA DE FIERRO', resumen: fila('10800') }],
    total: fila('10800'),
  }
}

const mg = (mes: number | null, datos: Partial<MargenMes> = {}): MargenMes => ({
  mes, ventasCantidad: '15.0000', ventasSoles: '18000', costoVentas: '16200', margen: '1800', porcentaje: '10',
  sinPrecio: { cantidad: '2.0000', costo: '2160' }, ...datos,
})

export function margenDemo(): Margen {
  return {
    anio: 2026,
    productos: [{ productoId: 1, productoCodigo: 'FIERRO', descripcion: 'CHATARRA DE FIERRO', meses: [mg(1), mg(2, { porcentaje: null, ventasSoles: '0', margen: '0', costoVentas: '0' })], total: mg(null) }],
    total: { meses: [mg(1), mg(2)], total: mg(null, { ventasSoles: '36000', costoVentas: '32400', margen: '3600' }) },
  }
}
