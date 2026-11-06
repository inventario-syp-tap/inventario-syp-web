import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampoDecimal } from './campo-decimal'
import { normalizarDecimal } from '@/lib/decimales'

function Prueba({ decimales = 4 }: { decimales?: number }) {
  const [valor, setValor] = useState('')
  return (
    <>
      <label htmlFor="cantidad">Cantidad TN</label>
      <CampoDecimal id="cantidad" valor={valor} alCambiar={setValor} decimales={decimales} />
      <output data-testid="valor">{valor}</output>
    </>
  )
}

describe('normalizarDecimal', () => {
  it('acepta coma o punto y entrega punto', () => {
    expect(normalizarDecimal('10,5', 4)).toBe('10.5')
    expect(normalizarDecimal('2.5000', 4)).toBe('2.5000')
  })

  it('rechaza letras, dos puntos, demasiados decimales y negativos (salvo que se permitan)', () => {
    expect(normalizarDecimal('1a', 4)).toBeNull()
    expect(normalizarDecimal('1.2.3', 4)).toBeNull()
    expect(normalizarDecimal('1.23456', 4)).toBeNull()
    expect(normalizarDecimal('-1', 4)).toBeNull()
    expect(normalizarDecimal('-1', 4, true)).toBe('-1')
    expect(normalizarDecimal('5.5', 0)).toBeNull()
  })
})

describe('CampoDecimal', () => {
  it('es texto con inputMode decimal, a la derecha, y entrega string con punto', async () => {
    render(<Prueba />)
    const campo = screen.getByLabelText('Cantidad TN')
    expect(campo).toHaveAttribute('type', 'text')
    expect(campo).toHaveAttribute('inputmode', 'decimal')
    expect(campo).toHaveClass('text-right', 'tabular-nums')
    await userEvent.type(campo, '12,34567')
    // El quinto decimal se ignora (4 decimales en TN)
    expect(screen.getByTestId('valor')).toHaveTextContent(/^12\.3456$/)
  })

  it('completa "5." y ".5" al salir del campo', async () => {
    render(<Prueba />)
    const campo = screen.getByLabelText('Cantidad TN')
    await userEvent.type(campo, '5.')
    await userEvent.tab()
    expect(screen.getByTestId('valor')).toHaveTextContent(/^5$/)
    await userEvent.clear(campo)
    await userEvent.type(campo, '.5')
    await userEvent.tab()
    expect(screen.getByTestId('valor')).toHaveTextContent(/^0\.5$/)
  })
})
