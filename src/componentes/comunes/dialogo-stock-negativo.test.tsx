import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DialogoStockNegativo } from './dialogo-stock-negativo'
import { leerDetalleStockNegativo } from '@/lib/stock-negativo'

const detalle = leerDetalleStockNegativo({ productoId: 1, fecha: '2026-03-20', saldoResultante: '-5.0000', disponibleAntes: '40.0000' })

function Prueba({ alConfirmar }: { alConfirmar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={boton} type="button" onClick={() => setAbierto(true)}>Guardar</button>
      <DialogoStockNegativo abierto={abierto} alCambiarAbierto={setAbierto} detalle={detalle} producto="FIERRO · Chatarra de fierro"
        alConfirmar={alConfirmar} focoAlCerrar={boton} />
    </>
  )
}

describe('DialogoStockNegativo', () => {
  it('muestra producto, fecha, disponible antes y saldo resultante (negativo con texto)', async () => {
    render(<Prueba alConfirmar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'El stock quedará en negativo' })
    expect(dialogo).toHaveAccessibleDescription(
      'Esta salida deja FIERRO · Chatarra de fierro en -5.0000 TN al 20/03/2026. ¿Registrar de todos modos?')
    expect(within(dialogo).getByText('40.0000')).toBeInTheDocument()
    expect(within(dialogo).getByText('-5.0000')).toBeInTheDocument()
    expect(within(dialogo).getByText('(negativo)')).toBeInTheDocument()
  })

  it('"Registrar de todos modos" confirma; "Cancelar" no, y el foco vuelve al botón', async () => {
    const alConfirmar = vi.fn()
    render(<Prueba alConfirmar={alConfirmar} />)
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    await userEvent.click(guardar)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(alConfirmar).not.toHaveBeenCalled()
    await waitFor(() => expect(guardar).toHaveFocus())
    await userEvent.click(guardar)
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar de todos modos' }))
    expect(alConfirmar).toHaveBeenCalledTimes(1)
  })

  it('lee el detalle aunque falten datos', () => {
    expect(leerDetalleStockNegativo({ productoId: '2' })).toEqual({ productoId: 2, fecha: null, saldoResultante: null, disponibleAntes: null })
  })
})
