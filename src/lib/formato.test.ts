import { describe, expect, it } from 'vitest'
import {
  fechaAIso, formatearCU, formatearDecimal, formatearDiferencia, formatearDocumento, formatearEntero, formatearFecha, formatearFechaHora, formatearPeriodo,
  formatearSoles, formatearTipoCambio, formatearToneladas, leerDiferencia,
} from './formato'

describe('formato es-PE (docs/UI-UX.md §9)', () => {
  it('toneladas con 4 decimales y miles con coma', () => {
    expect(formatearToneladas('1234.5')).toBe('1,234.5000')
    expect(formatearToneladas('10')).toBe('10.0000')
    expect(formatearToneladas('1234567.12345')).toBe('1,234,567.1235')
  })

  it('conteos enteros con miles con coma', () => {
    expect(formatearEntero(0)).toBe('0')
    expect(formatearEntero(1234)).toBe('1,234')
  })

  it('soles con 2 decimales y prefijo S/', () => {
    expect(formatearSoles('1234.5')).toBe('S/ 1,234.50')
    expect(formatearSoles('3480.0000000000')).toBe('S/ 3,480.00')
  })

  it('redondea mitad hacia arriba sin perder precisión (big.js, no Number)', () => {
    expect(formatearDecimal('0.005', 2)).toBe('0.01')
    expect(formatearDecimal('1.0049999999999999999', 2)).toBe('1.00')
    expect(formatearDecimal('12345678901234567890.125', 2)).toBe('12,345,678,901,234,567,890.13')
    expect(formatearDecimal('2.58e-10', 6)).toBe('0.000000')
  })

  it('negativos con signo menos y sin "-0"', () => {
    expect(formatearToneladas('-5')).toBe('-5.0000')
    expect(formatearSoles('-300')).toBe('S/ -300.00')
    expect(formatearDecimal('-0.00001', 2)).toBe('0.00')
  })

  it('costo unitario con 2 decimales y 4 en el detalle; tipo de cambio con 3', () => {
    expect(formatearCU('60.123456')).toBe('60.12')
    expect(formatearCU('60.123456', true)).toBe('60.1235')
    expect(formatearTipoCambio('3.7')).toBe('3.700')
  })

  it('vacío o nulo se muestra como raya y un texto inválido se devuelve tal cual', () => {
    expect(formatearToneladas(null)).toBe('—')
    expect(formatearSoles('')).toBe('—')
    expect(formatearToneladas('abc')).toBe('abc')
  })

  it('fechas dd/mm/aaaa partiendo el texto (sin corrimiento por zona horaria)', () => {
    expect(formatearFecha('2026-03-15')).toBe('15/03/2026')
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026')
    expect(formatearFecha('2026-03-15T00:00:00.000Z')).toBe('15/03/2026')
    expect(fechaAIso('15/03/2026')).toBe('2026-03-15')
    expect(fechaAIso('15-03-2026')).toBeNull()
  })

  it('periodo con "Setiembre"', () => {
    expect(formatearPeriodo(2026, 3)).toBe('Marzo 2026')
    expect(formatearPeriodo(2026, 9)).toBe('Setiembre 2026')
  })

  it('documento con número de 7 dígitos', () => {
    expect(formatearDocumento('F001', '123')).toBe('F001-0000123')
    expect(formatearDocumento('00-AI', '0001')).toBe('00-AI-0000001')
  })

  it('diferencia de paridad: 6 decimales y el valor exacto con × 10 y superíndice', () => {
    expect(formatearDiferencia('2.58e-10')).toBe('0.000000 (2.58 × 10⁻¹⁰)')
    expect(formatearDiferencia('3.83e-11')).toBe('0.000000 (3.83 × 10⁻¹¹)')
    expect(formatearDiferencia('0.0100')).toBe('0.010000 (1 × 10⁻²)')
    expect(formatearDiferencia('-2.5e-7')).toBe('0.000000 (-2.5 × 10⁻⁷)')
    expect(formatearDiferencia('12.5')).toBe('12.500000 (1.25 × 10¹)')
    expect(formatearDiferencia('1.000000')).toBe('1.000000 (1 × 10⁰)')
  })

  it('diferencia exactamente cero: solo los 6 decimales', () => {
    expect(formatearDiferencia('0')).toBe('0.000000')
    expect(formatearDiferencia('0.000000')).toBe('0.000000')
    expect(formatearDiferencia('0e0')).toBe('0.000000')
    expect(formatearDiferencia(null)).toBe('—')
    expect(formatearDiferencia('abc')).toBe('abc')
  })

  it('diferencia en palabras para lectores de pantalla', () => {
    expect(leerDiferencia('2.58e-10')).toBe('0.000000, valor exacto 2.58 por 10 a la menos 10')
    expect(leerDiferencia('0.0100')).toBe('0.010000, valor exacto 1 por 10 a la menos 2')
    expect(leerDiferencia('-2.5e-7')).toBe('0.000000, valor exacto menos 2.5 por 10 a la menos 7')
    expect(leerDiferencia('12.5')).toBe('12.500000, valor exacto 1.25 por 10 a la 1')
    expect(leerDiferencia('0')).toBe('0.000000')
    expect(leerDiferencia(null)).toBe('—')
  })
})

describe('formatearFechaHora', () => {
  it('muestra un instante ISO como dd/mm/aaaa hh:mm en la hora local', () => {
    expect(formatearFechaHora('2026-10-20T14:30:00.000Z')).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/)
    expect(formatearFechaHora(null)).toBe('—')
  })
})
