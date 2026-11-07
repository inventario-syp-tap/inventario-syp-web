import { describe, expect, it } from 'vitest'
import { campoDelFormulario, MENSAJE_ASISTENTE_SIN_PERMISO, ubicarErrorOperacion, type ContextoError } from './errores-operacion'
import { lineaVacia, valoresNuevos } from './esquemas'
import { ErrorApi } from '@/lib/errores'

const valores = {
  ...valoresNuevos('VENTA', '2026-03-20', '1'),
  serie: 'f001',
  numero: '123',
  lineas: [
    { ...lineaVacia('SALIDA'), productoId: '1', descripcion: 'x', cantidad: '1', precio: '900' },
    { ...lineaVacia('SALIDA'), productoId: '2', descripcion: 'y', cantidad: '1', precio: '' },
  ],
}

const ctx = (datos: Partial<ContextoError> = {}): ContextoError => ({
  naturaleza: 'VENTA', valores, nombreProducto: (id) => (id === 1 ? 'FIERRO · Chatarra de fierro' : null), edicion: false, soloAsistente: false,
  ...datos,
})

const error = (status: number, codigo: string, detalle?: Record<string, unknown>) => new ErrorApi(status, codigo, 'texto de la API', detalle)

describe('ubicarErrorOperacion', () => {
  it('409 STOCK_NEGATIVO_REQUIERE_CONFIRMACION → diálogo con el detalle', () => {
    expect(ubicarErrorOperacion(error(409, 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION',
      { productoId: 1, fecha: '2026-03-20', saldoResultante: '-5.0000', disponibleAntes: '40.0000' }), ctx())).toEqual({
      tipo: 'confirmar',
      detalle: { productoId: 1, fecha: '2026-03-20', saldoResultante: '-5.0000', disponibleAntes: '40.0000' },
    })
  })

  it('409 ORDEN_EN_CONFLICTO → reintentar', () => {
    expect(ubicarErrorOperacion(error(409, 'ORDEN_EN_CONFLICTO'), ctx())).toEqual({
      tipo: 'reintentar', mensaje: 'Otro usuario modificó este kardex al mismo tiempo; vuelve a intentarlo.',
    })
  })

  it('409 STOCK_INSUFICIENTE → encabezado con el producto, sin confirmar', () => {
    expect(ubicarErrorOperacion(error(409, 'STOCK_INSUFICIENTE', { productoId: 1, fecha: '2026-03-20', disponibleAntes: '40' }), ctx())).toEqual({
      tipo: 'formulario', campos: [],
      mensaje: 'No hay stock suficiente de FIERRO · Chatarra de fierro al 20/03/2026 (disponible 40.0000 TN).',
    })
  })

  it('409 PERIODO_CERRADO → encabezado con el mes de la fecha y error en Fecha', () => {
    expect(ubicarErrorOperacion(error(409, 'PERIODO_CERRADO'), ctx())).toEqual({
      tipo: 'formulario',
      mensaje: 'El mes de marzo de 2026 está cerrado: no se puede registrar ni modificar. Pide reabrirlo si necesitas cambiarlo.',
      campos: [{ campo: 'fecha', mensaje: 'Ese mes está cerrado.' }],
    })
  })

  it('409 COMPROBANTE_DUPLICADO → junto al número, con tipo y tercero', () => {
    expect(ubicarErrorOperacion(error(409, 'COMPROBANTE_DUPLICADO'), ctx())).toEqual({
      tipo: 'formulario', mensaje: null, campos: [{ campo: 'numero', mensaje: 'Ya existe la factura F001-0000123 de este cliente.' }],
    })
    const compra = ubicarErrorOperacion(error(409, 'COMPROBANTE_DUPLICADO'), ctx({ naturaleza: 'COMPRA' }))
    expect(compra).toMatchObject({ campos: [{ campo: 'numero', mensaje: 'Ya existe la factura F001-0000123 de este proveedor.' }] })
  })

  it('409 COMPROBANTE_ANULADO → encabezado y solo lectura', () => {
    expect(ubicarErrorOperacion(error(409, 'COMPROBANTE_ANULADO'), ctx({ edicion: true }))).toEqual({
      tipo: 'formulario', mensaje: 'Ese comprobante está anulado: ya no se puede editar ni mover.', campos: [], soloLectura: true,
    })
  })

  it('422 PRECIO_VENTA_REQUERIDO → en la línea del detalle o en las que no tienen valor', () => {
    expect(ubicarErrorOperacion(error(422, 'PRECIO_VENTA_REQUERIDO', { linea: 0 }), ctx())).toMatchObject({
      campos: [{ campo: 'lineas.0.precio', mensaje: 'Indica el valor de venta sin IGV.' }],
    })
    expect(ubicarErrorOperacion(error(422, 'PRECIO_VENTA_REQUERIDO'), ctx())).toMatchObject({ campos: [{ campo: 'lineas.1.precio' }] })
  })

  it.each([
    ['TIPO_CAMBIO_REQUERIDO', 'tipoCambio'],
    ['SUSTENTO_REQUERIDO', 'sustento'],
    ['SALDO_INICIAL_INEXISTENTE', 'fecha'],
    ['TERCERO_INEXISTENTE', 'tercero'],
    ['ESTABLECIMIENTO_INEXISTENTE', 'establecimientoId'],
  ])('422 %s → junto a %s', (codigo, campo) => {
    const ubicacion = ubicarErrorOperacion(error(422, codigo), ctx())
    expect(ubicacion).toMatchObject({ tipo: 'formulario', mensaje: null, campos: [{ campo }] })
  })

  it('SALDO_INICIAL_INEXISTENTE nombra el año de la fecha', () => {
    expect(ubicarErrorOperacion(error(422, 'SALDO_INICIAL_INEXISTENTE'), ctx())).toMatchObject({
      campos: [{ campo: 'fecha', mensaje: 'Falta el saldo inicial de 2026: haz el cierre anual de 2025.' }],
    })
  })

  it('403 al editar siendo solo ASISTENTE → solo sus compras y ventas', () => {
    expect(ubicarErrorOperacion(error(403, 'SIN_PERMISO'), ctx({ edicion: true, soloAsistente: true }))).toMatchObject({ mensaje: MENSAJE_ASISTENTE_SIN_PERMISO })
    expect(ubicarErrorOperacion(error(403, 'SIN_PERMISO'), ctx())).toMatchObject({ mensaje: 'No tienes permiso para esta acción.' })
  })

  it('400 VALIDACION → campos del formulario (terceroId → tercero, valorVentaUnitario → precio)', () => {
    const ubicacion = ubicarErrorOperacion(error(400, 'VALIDACION', {
      campos: { terceroId: 'Requerido', 'lineas.1.valorVentaUnitario': 'Formato', otroCampo: 'x' },
    }), ctx())
    expect(ubicacion).toEqual({
      tipo: 'formulario',
      mensaje: 'Revisa los campos marcados.',
      campos: [{ campo: 'tercero', mensaje: 'Requerido' }, { campo: 'lineas.1.precio', mensaje: 'Formato' }],
    })
    expect(campoDelFormulario('lineas[0].costoUnitario')).toBe('lineas.0.precio')
  })

  it('un error que no es de la API va al encabezado', () => {
    expect(ubicarErrorOperacion(new Error('x'), ctx())).toEqual({ tipo: 'formulario', mensaje: 'Ocurrió un error inesperado. Intenta de nuevo.', campos: [] })
  })
})
