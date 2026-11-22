import { describe, expect, it } from 'vitest'
import { esquemaExportarWinConta } from './esquemas'

const errores = (numeroAsiento: string, tipoCambio: string) => {
  const resultado = esquemaExportarWinConta.safeParse({ numeroAsiento, tipoCambio })
  return resultado.success ? [] : resultado.error.issues.map((i) => i.message)
}

describe('Exportar a WinConta: validación', () => {
  it('acepta 4 dígitos y un tipo de cambio mayor que 0 con hasta 3 decimales (como texto)', () => {
    expect(errores('0001', '3.750')).toEqual([])
    expect(errores('0001', '4')).toEqual([])
    const resultado = esquemaExportarWinConta.parse({ numeroAsiento: '0001', tipoCambio: '3.750' })
    expect(resultado).toEqual({ numeroAsiento: '0001', tipoCambio: '3.750' })
  })

  it.each([
    ['', 'Indica el número de asiento.'],
    ['1', 'El número de asiento debe tener exactamente 4 dígitos (por ejemplo, 0001).'],
    ['00001', 'El número de asiento debe tener exactamente 4 dígitos (por ejemplo, 0001).'],
    ['00a1', 'El número de asiento debe tener exactamente 4 dígitos (por ejemplo, 0001).'],
  ])('número de asiento "%s" → %s', (numero, mensaje) => {
    expect(errores(numero, '3.750')).toContain(mensaje)
  })

  it.each([
    ['', 'Indica el tipo de cambio.'],
    ['0', 'El tipo de cambio debe ser mayor que 0.'],
    ['0.000', 'El tipo de cambio debe ser mayor que 0.'],
    ['3.7501', 'El tipo de cambio admite hasta 3 decimales (por ejemplo, 3.750).'],
    ['-3.750', 'El tipo de cambio admite hasta 3 decimales (por ejemplo, 3.750).'],
  ])('tipo de cambio "%s" → %s', (tipoCambio, mensaje) => {
    expect(errores('0001', tipoCambio)).toContain(mensaje)
  })
})
