// Datos de demostración para las pruebas de comprobantes (docs/UI-UX.md §10): FIERRO, INOXIDABLE, PROVEEDOR DEMO,
// CLIENTE DEMO, F001-0000123 y E001-0000045, con cantidades y costos redondos. Nada sale de datos reales.
import type { Comprobante, LineaComprobante, ResultadoEscritura } from '@/api/comprobantes'
import type { Establecimiento } from '@/api/establecimientos'
import type { Producto } from '@/api/productos'
import type { Tercero } from '@/api/terceros'

const producto = (id: number, codigo: string, descripcion: string): Producto => ({
  id, codigo, codigoLibro: codigo, descripcion, tipoExistencia: '01', unidadMedida: 'TNE', metodoValuacion: '1',
  cuentaInventario: '2011', cuentaCostoVentas: '6911', denominacionContable: descripcion, activo: true,
})

export const productosDemo: Producto[] = [
  producto(1, 'FIERRO', 'Chatarra de fierro'),
  producto(2, 'INOXIDABLE', 'Chatarra inoxidable'),
  { ...producto(3, 'COBRE', 'Chatarra de cobre'), activo: false },
]

export const establecimientosDemo: Establecimiento[] = [
  { id: 1, codigo: '0001', nombre: 'LOCAL DEMO', textoLibro: '0001-LOCAL DEMO', activo: true },
]

export const proveedorDemo: Tercero = {
  id: 10, tipoDocumento: '6', numeroDocumento: '20000000010', razonSocial: 'PROVEEDOR DEMO S.A.C.', pais: 'PE',
  esProveedor: true, esCliente: false, direccion: null, activo: true,
}

export const clienteDemo: Tercero = {
  id: 28, tipoDocumento: '6', numeroDocumento: '20000000028', razonSocial: 'CLIENTE DEMO S.A.C.', pais: 'PE',
  esProveedor: false, esCliente: true, direccion: null, activo: true,
}

export function lineaDemo(datos: Partial<LineaComprobante> = {}): LineaComprobante {
  return {
    id: 'linea-1', productoId: 1, productoCodigo: 'FIERRO', establecimientoId: 1, anio: 2026, orden: 3,
    fecha: '2026-03-15', tipoMovimiento: 'ENTRADA', tipoOperacion: '02', descripcion: 'Chatarra pesada', cantidad: '10.0000',
    costoUnitario: '100.000000', costoAlPromedio: false, valorVentaUnitario: null, costoTotalEntrada: '1000.00',
    costoUnitarioSalida: null, costoTotalSalida: null, saldoCantidad: '10.0000', saldoCostoUnitario: '100.000000',
    saldoCostoTotal: '1000.00', alertas: [],
    ...datos,
  }
}

export function comprobanteDemo(datos: Partial<Comprobante> = {}): Comprobante {
  return {
    id: 'comp-1', naturaleza: 'COMPRA', tipoComprobante: '01', serie: 'F001', numero: '123', documento: '01-F001-123',
    fecha: '2026-03-15', tipoOperacion: '02',
    tercero: { id: 10, tipoDocumento: '6', numeroDocumento: '20000000010', razonSocial: 'PROVEEDOR DEMO S.A.C.' },
    moneda: 'PEN', tipoCambio: null, sustento: null, guiaRemision: null, ticketBalanza: null, placaVehiculo: null,
    observacion: null, estado: 'REGISTRADO', motivoAnulacion: null, anuladoEn: null, origenImportacion: null,
    creadoEn: '2026-03-15T15:00:00.000Z', lineas: [lineaDemo()],
    ...datos,
  }
}

export const ventaDemo = (datos: Partial<Comprobante> = {}) => comprobanteDemo({
  id: 'comp-2', naturaleza: 'VENTA', serie: 'E001', numero: '45', documento: '01-E001-45', tipoOperacion: '01',
  tercero: { id: 28, tipoDocumento: '6', numeroDocumento: '20000000028', razonSocial: 'CLIENTE DEMO S.A.C.' },
  lineas: [lineaDemo({ id: 'linea-2', tipoMovimiento: 'SALIDA', tipoOperacion: '01', cantidad: '2.5000', costoUnitario: null,
    valorVentaUnitario: '900.000000', costoTotalEntrada: null, costoUnitarioSalida: '100.000000', costoTotalSalida: '250.00',
    saldoCantidad: '7.5000', saldoCostoTotal: '750.00' })],
  ...datos,
})

export const resultadoDemo = (comprobante: Comprobante): ResultadoEscritura => ({
  comprobante,
  kardex: [{ productoId: 1, establecimientoId: 1, anio: 2026, saldoFinal: { cantidad: '10', costoTotal: '1000', costoUnitario: '100' }, alertas: [] }],
})
