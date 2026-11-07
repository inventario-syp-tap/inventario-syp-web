import { describe, expect, it } from 'vitest'
import { camposConError, ErrorApi, mensajeDeError } from './errores'

describe('mensajes de error (docs/UI-UX.md §6)', () => {
  it('traduce el código de la API al mensaje en español', () => {
    expect(mensajeDeError(new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'x'))).toBe(
      'Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.',
    )
    expect(mensajeDeError(new ErrorApi(429, 'DEMASIADAS_SOLICITUDES', 'x'))).toMatch(/Espera un minuto/)
  })

  it('completa el mes del periodo cerrado (del detalle o de la fecha del comprobante)', () => {
    expect(mensajeDeError(new ErrorApi(409, 'PERIODO_CERRADO', '', { anio: 2026, mes: 3 }))).toBe(
      'El mes de marzo de 2026 está cerrado: no se puede registrar ni modificar. Pide reabrirlo si necesitas cambiarlo.',
    )
    expect(mensajeDeError(new ErrorApi(409, 'PERIODO_CERRADO', '', { fecha: '2026-09-15' }))).toMatch(/^El mes de setiembre de 2026 está cerrado/)
    expect(mensajeDeError(new ErrorApi(409, 'PERIODO_CERRADO', ''))).toMatch(/^El mes está cerrado: no se puede registrar ni modificar/)
  })

  it('incluye el requestId en el error interno', () => {
    expect(mensajeDeError(new ErrorApi(500, 'ERROR_INTERNO', '', undefined, 'abc-123'))).toMatch(/código abc-123/)
  })

  it('usa el mensaje de la API si el código es desconocido', () => {
    expect(mensajeDeError(new ErrorApi(409, 'CODIGO_NUEVO', 'Mensaje de la API'))).toBe('Mensaje de la API')
  })

  it('error que no es de la API: mensaje genérico', () => {
    expect(mensajeDeError(new Error('boom'))).toBe('Ocurrió un error inesperado. Intenta de nuevo.')
  })
})

describe('códigos del S7', () => {
  it('tienen mensaje en español', () => {
    for (const codigo of ['TERCERO_DUPLICADO', 'PRODUCTO_DUPLICADO', 'ESTABLECIMIENTO_DUPLICADO', 'CODIGO_SUNAT_INVALIDO',
      'CUENTA_INVALIDA', 'OPERACION_NO_CORRESPONDE', 'VIGENCIA_SUPERPUESTA', 'SIN_PERMISO']) {
      expect(mensajeDeError(new ErrorApi(409, codigo, 'texto de la API'))).not.toBe('texto de la API')
    }
  })

  it('camposConError lee detalle.campos en sus dos formas', () => {
    expect(camposConError(new ErrorApi(400, 'VALIDACION', 'x', { campos: { codigo: ['Muy largo'] } }))).toEqual({ codigo: 'Muy largo' })
    expect(camposConError(new ErrorApi(400, 'VALIDACION', 'x', { campos: [{ campo: 'nombre', mensaje: 'Vacío' }] }))).toEqual({ nombre: 'Vacío' })
    expect(camposConError(new ErrorApi(409, 'TERCERO_DUPLICADO', 'x'))).toEqual({})
  })
})

describe('códigos del S8', () => {
  it('tienen mensaje en español', () => {
    for (const codigo of ['ORDEN_EN_CONFLICTO', 'TERCERO_INEXISTENTE', 'ESTABLECIMIENTO_INEXISTENTE', 'COMPROBANTE_ANULADO',
      'STOCK_NEGATIVO_REQUIERE_CONFIRMACION', 'PRECIO_VENTA_REQUERIDO', 'TIPO_CAMBIO_REQUERIDO', 'SUSTENTO_REQUERIDO']) {
      expect(mensajeDeError(new ErrorApi(409, codigo, 'texto de la API'))).not.toBe('texto de la API')
    }
  })

  it('saldo inicial inexistente y stock insuficiente usan el detalle', () => {
    expect(mensajeDeError(new ErrorApi(422, 'SALDO_INICIAL_INEXISTENTE', '', { anio: 2026 })))
      .toBe('Falta el saldo inicial de 2026: haz el cierre anual de 2025.')
    expect(mensajeDeError(new ErrorApi(409, 'STOCK_INSUFICIENTE', '', { producto: 'FIERRO', fecha: '2026-03-20', disponibleAntes: '40' })))
      .toBe('No hay stock suficiente de FIERRO al 20/03/2026 (disponible 40.0000 TN).')
  })
})
