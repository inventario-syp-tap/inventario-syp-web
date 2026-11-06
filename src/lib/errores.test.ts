import { describe, expect, it } from 'vitest'
import { camposConError, ErrorApi, mensajeDeError } from './errores'

describe('mensajes de error (docs/UI-UX.md §6)', () => {
  it('traduce el código de la API al mensaje en español', () => {
    expect(mensajeDeError(new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'x'))).toBe(
      'Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.',
    )
    expect(mensajeDeError(new ErrorApi(429, 'DEMASIADAS_SOLICITUDES', 'x'))).toMatch(/Espera un minuto/)
  })

  it('completa el mes del periodo cerrado', () => {
    expect(mensajeDeError(new ErrorApi(409, 'PERIODO_CERRADO', '', { anio: 2026, mes: 3 }))).toBe(
      'El mes de marzo está cerrado. Pide reabrirlo si necesitas cambiarlo.',
    )
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
