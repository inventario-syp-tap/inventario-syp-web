import { describe, expect, it } from 'vitest'
import {
  aAjuste, aCompra, aEditar, aMerma, aVenta, documentoComprobante, esquemaComprobante, formatearImporte, importeLinea,
  lineaVacia, totales, valoresDesdeComprobante, valoresNuevos, type FormularioComprobante,
} from './esquemas'
import { comprobanteDemo, ventaDemo } from '@/pruebas/comprobantes-demo'

const proveedor = { id: 10, tipoDocumento: '6', numeroDocumento: '20000000010', razonSocial: 'PROVEEDOR DEMO S.A.C.' }

function compra(datos: Partial<FormularioComprobante> = {}): FormularioComprobante {
  return {
    ...valoresNuevos('COMPRA', '2026-03-15', '1'),
    tercero: proveedor,
    serie: 'f001',
    numero: '123',
    lineas: [
      { ...lineaVacia('ENTRADA'), productoId: '1', descripcion: 'Chatarra pesada', cantidad: '10.0000', precio: '100.000000' },
      { ...lineaVacia('ENTRADA'), productoId: '2', descripcion: 'Chatarra inox B', cantidad: '2.5', precio: '1000' },
    ],
    ...datos,
  }
}

const errores = (naturaleza: Parameters<typeof esquemaComprobante>[0], valores: FormularioComprobante) => {
  const resultado = esquemaComprobante(naturaleza).safeParse(valores)
  return resultado.success ? {} : Object.fromEntries(resultado.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('esquema del formulario (zod)', () => {
  it('una compra completa es válida; sin proveedor, cantidad 0 o costo con 7 decimales, no', () => {
    expect(errores('COMPRA', compra())).toEqual({})
    const malos = errores('COMPRA', compra({
      tercero: null,
      lineas: [{ ...lineaVacia('ENTRADA'), productoId: '1', descripcion: 'x', cantidad: '0', precio: '1.1234567' }],
    }))
    expect(malos.tercero).toBe('Elige el proveedor.')
    expect(malos['lineas.0.cantidad']).toMatch(/mayor que 0/)
    expect(malos['lineas.0.precio']).toMatch(/costo sin IGV/)
  })

  it('venta: boleta (03) no admite exportación (17) y USD exige tipo de cambio', () => {
    const venta = { ...compra(), tipoOperacion: '17', tipoComprobante: '03' as const, moneda: 'USD' as const }
    const malos = errores('VENTA', venta)
    expect(malos.tipoOperacion).toBe('La exportación requiere factura.')
    expect(malos.tipoCambio).toMatch(/tipo de cambio/)
    expect(errores('VENTA', { ...venta, tipoComprobante: '01', tipoCambio: '3.750' })).toEqual({})
  })

  it('merma: sustento obligatorio y año del informe solo en 13', () => {
    const merma = { ...valoresNuevos('MERMA', '2026-03-15', '1'), lineas: [{ ...lineaVacia('SALIDA'), productoId: '1', descripcion: 'x', cantidad: '1' }] }
    expect(errores('MERMA', { ...merma, anioInforme: '26' })).toEqual({
      anioInforme: 'Indica el año del informe técnico (AAAA).',
      sustento: 'Indica el sustento (informe técnico o acta).',
    })
    expect(errores('MERMA', { ...merma, tipoOperacion: '14', anioInforme: '', sustento: 'ACTA DEMO' })).toEqual({})
  })

  it('ajuste: el costo solo se exige en entradas con costo informado', () => {
    const base = { ...valoresNuevos('AJUSTE', '2026-03-31', '1'), sustento: 'ACTA DE TOMA DE INVENTARIO DEMO' }
    const linea = { ...lineaVacia('ENTRADA'), productoId: '1', descripcion: 'Sobrante', cantidad: '1' }
    expect(errores('AJUSTE', { ...base, lineas: [linea] })).toEqual({})
    expect(errores('AJUSTE', { ...base, lineas: [{ ...linea, costoAlPromedio: false }] })['lineas.0.precio']).toMatch(/costo/)
    expect(errores('AJUSTE', { ...base, lineas: [{ ...linea, tipoMovimiento: 'SALIDA', costoAlPromedio: false }] })).toEqual({})
  })
})

describe('conversión a los DTO (decimales como string, sin redondear)', () => {
  it('compra', () => {
    expect(aCompra(compra())).toEqual({
      fecha: '2026-03-15', establecimientoId: 1, serie: 'F001', numero: '123', terceroId: 10, tipoComprobante: '01',
      lineas: [
        { productoId: 1, descripcion: 'Chatarra pesada', cantidad: '10.0000', costoUnitario: '100.000000' },
        { productoId: 2, descripcion: 'Chatarra inox B', cantidad: '2.5', costoUnitario: '1000' },
      ],
    })
  })

  it('venta: con boleta la operación queda en 01 y en PEN no va el tipo de cambio', () => {
    const datos = aVenta({ ...compra(), tipoComprobante: '03', tipoOperacion: '17', moneda: 'PEN', tipoCambio: '3.7' })
    expect(datos.tipoOperacion).toBe('01')
    expect(datos.tipoCambio).toBeUndefined()
    expect(datos.lineas[0]).toEqual({ productoId: 1, descripcion: 'Chatarra pesada', cantidad: '10.0000', valorVentaUnitario: '100.000000' })
    expect(aVenta({ ...compra(), tipoOperacion: '17', moneda: 'USD', tipoCambio: '3.750' })).toMatchObject({ tipoOperacion: '17', moneda: 'USD', tipoCambio: '3.750' })
  })

  it('merma 13 con año del informe; desmedro 14 sin él', () => {
    const merma = { ...valoresNuevos('MERMA', '2026-03-15', '1'), sustento: ' INFORME DEMO ', lineas: [{ ...lineaVacia('SALIDA'), productoId: '1', descripcion: 'x', cantidad: '1.5' }] }
    expect(aMerma(merma)).toMatchObject({ tipoOperacion: '13', anioInforme: 2026, sustento: 'INFORME DEMO' })
    expect(aMerma({ ...merma, tipoOperacion: '14' }).anioInforme).toBeUndefined()
  })

  it('ajuste: entrada al promedio, entrada con costo y salida', () => {
    const base = { ...valoresNuevos('AJUSTE', '2026-03-31', '1'), sustento: 'ACTA DEMO' }
    const l = { ...lineaVacia('ENTRADA'), productoId: '1', descripcion: 'x', cantidad: '1' }
    expect(aAjuste({ ...base, lineas: [l, { ...l, costoAlPromedio: false, precio: '54' }, { ...l, tipoMovimiento: 'SALIDA' }] }).lineas).toEqual([
      { productoId: 1, descripcion: 'x', cantidad: '1', tipoMovimiento: 'ENTRADA', costoAlPromedio: true },
      { productoId: 1, descripcion: 'x', cantidad: '1', tipoMovimiento: 'ENTRADA', costoUnitario: '54' },
      { productoId: 1, descripcion: 'x', cantidad: '1', tipoMovimiento: 'SALIDA' },
    ])
  })

  it('editar: solo lo que cambió; las líneas conservan su id', () => {
    const inicial = valoresDesdeComprobante(comprobanteDemo())
    expect(aEditar('COMPRA', inicial, inicial)).toEqual({})
    expect(aEditar('COMPRA', { ...inicial, numero: '124' }, inicial)).toEqual({ numero: '124' })
    const lineas = [{ ...inicial.lineas[0], cantidad: '12.0000' }]
    expect(aEditar('COMPRA', { ...inicial, lineas }, inicial)).toEqual({
      lineas: [{ id: 'linea-1', productoId: 1, descripcion: 'Chatarra pesada', cantidad: '12.0000', costoUnitario: '100.000000' }],
    })
  })

  it('editar venta: pasar a PEN borra el tipo de cambio', () => {
    const inicial = valoresDesdeComprobante(ventaDemo({ moneda: 'USD', tipoCambio: '3.750', tipoOperacion: '17' }))
    expect(aEditar('VENTA', { ...inicial, moneda: 'PEN', tipoOperacion: '01' }, inicial)).toEqual({ moneda: 'PEN', tipoCambio: null, tipoOperacion: '01' })
  })
})

describe('vista previa con big.js', () => {
  it('importe por línea y totales exactos', () => {
    expect(importeLinea({ cantidad: '10.0000', precio: '100.000000' })).toBe('1000.00')
    expect(importeLinea({ cantidad: '0.1', precio: '0.2' })).toBe('0.02')
    expect(importeLinea({ cantidad: '', precio: '1' })).toBeNull()
    expect(totales('COMPRA', compra().lineas)).toEqual({ toneladas: '12.5000', importe: '3500.00' })
    expect(totales('MERMA', compra().lineas)).toEqual({ toneladas: '12.5000', importe: null })
  })

  it('importes en soles o dólares y documento', () => {
    expect(formatearImporte('3500', 'PEN')).toBe('S/ 3,500.00')
    expect(formatearImporte('3500', 'USD')).toBe('US$ 3,500.00')
    expect(documentoComprobante(comprobanteDemo())).toBe('F001-0000123')
    expect(documentoComprobante(comprobanteDemo({ tipoComprobante: '00', serie: 'IT', numero: '2026', documento: '00-IT-2026' }))).toBe('00-IT-2026')
  })
})
