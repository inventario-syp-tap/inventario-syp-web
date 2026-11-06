import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DialogoConfirmacion } from './dialogo-confirmacion'

function renderizar(motivo?: 'opcional' | 'obligatorio') {
  const alConfirmar = vi.fn()
  const alCambiarAbierto = vi.fn()
  render(
    <DialogoConfirmacion
      abierto
      alCambiarAbierto={alCambiarAbierto}
      titulo="¿Anular F001-0000123?"
      descripcion="Se anulará F001-0000123 y se recalculará el kardex de FIERRO 2026."
      textoConfirmar="Anular"
      alConfirmar={alConfirmar}
      motivo={motivo}
      destructiva
    />,
  )
  return { alConfirmar, alCambiarAbierto, dialogo: screen.getByRole('alertdialog', { name: '¿Anular F001-0000123?' }) }
}

describe('DialogoConfirmacion', () => {
  it('sin motivo confirma con cadena vacía', async () => {
    const { alConfirmar, dialogo } = renderizar()
    expect(within(dialogo).queryByLabelText(/Motivo/)).not.toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular' }))
    expect(alConfirmar).toHaveBeenCalledWith('')
  })

  it('con motivo obligatorio no confirma vacío y muestra el error junto al campo', async () => {
    const { alConfirmar, dialogo } = renderizar('obligatorio')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular' }))
    expect(alConfirmar).not.toHaveBeenCalled()
    const campo = within(dialogo).getByLabelText('Motivo')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription('Escribe el motivo.')
    await userEvent.type(campo, '  Comprobante registrado dos veces  ')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular' }))
    expect(alConfirmar).toHaveBeenCalledWith('Comprobante registrado dos veces')
  })

  it('con motivo opcional deja confirmar en blanco', async () => {
    const { alConfirmar, dialogo } = renderizar('opcional')
    expect(within(dialogo).getByLabelText('Motivo (opcional)')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Anular' }))
    expect(alConfirmar).toHaveBeenCalledWith('')
  })
})
