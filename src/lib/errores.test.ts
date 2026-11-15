import { describe, expect, it } from 'vitest'
import { camposConError, ErrorApi, esConflicto, mensajeDeError } from './errores'

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

describe('códigos del S9 (kardex, periodos y cierre anual)', () => {
  it('ORDEN_EN_CONFLICTO y CONFLICTO_CONCURRENTE: mismo mensaje y se reconocen como conflicto', () => {
    for (const codigo of ['ORDEN_EN_CONFLICTO', 'CONFLICTO_CONCURRENTE']) {
      const error = new ErrorApi(409, codigo, 'x')
      expect(mensajeDeError(error)).toBe('Otro usuario modificó estos datos al mismo tiempo.')
      expect(esConflicto(error)).toBe(true)
    }
    expect(esConflicto(new ErrorApi(409, 'PERIODO_CERRADO', 'x'))).toBe(false)
  })

  it('periodos: futuro, anterior al inicio y no cerrado', () => {
    expect(mensajeDeError(new ErrorApi(422, 'PERIODO_FUTURO', 'x')))
      .toBe('Ese mes aún no llega: no se puede cerrar un mes posterior al mes en curso.')
    expect(mensajeDeError(new ErrorApi(422, 'PERIODO_ANTERIOR_AL_INICIO', 'x')))
      .toBe('Ese mes es anterior al primer periodo registrado en el sistema: no hay nada que cerrar.')
    expect(mensajeDeError(new ErrorApi(409, 'PERIODO_NO_CERRADO', 'x'))).toBe('Ese mes no está cerrado: no hay nada que reabrir.')
  })

  it('saldo cero con costo nombra el mes del detalle (periodo, periodos o anio + mes)', () => {
    const texto = 'No se puede cerrar marzo de 2026: hay movimientos con saldo cero y costo. Revísalos en el kardex (lista abajo).'
    expect(mensajeDeError(new ErrorApi(409, 'CIERRE_CON_SALDO_CERO_CON_COSTO', '', { periodo: '2026-03' }))).toBe(texto)
    expect(mensajeDeError(new ErrorApi(409, 'CIERRE_CON_SALDO_CERO_CON_COSTO', '', { periodos: ['2026-03'] }))).toBe(texto)
    expect(mensajeDeError(new ErrorApi(409, 'CIERRE_CON_SALDO_CERO_CON_COSTO', '', { anio: 2026, mes: 3 }))).toBe(texto)
    expect(mensajeDeError(new ErrorApi(409, 'CIERRE_CON_SALDO_CERO_CON_COSTO', ''))).toMatch(/^No se puede cerrar el mes:/)
  })

  it('saldo inicial que requiere confirmación nombra el año siguiente', () => {
    expect(mensajeDeError(new ErrorApi(409, 'SALDO_INICIAL_REQUIERE_CONFIRMACION', '', { anioSiguiente: 2026 })))
      .toBe('El saldo inicial de 2026 ya existe y es distinto. Elige si lo reemplazas o lo conservas.')
  })
})
