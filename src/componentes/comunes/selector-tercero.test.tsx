import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectorTercero } from './selector-tercero'
import { solicitar } from '@/api/cliente'
import type { Tercero } from '@/api/terceros'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { catalogosDemo, crearApiFalsa, renderizarConSesion } from '@/pruebas/api-falsa'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const proveedor: Tercero = {
  id: 1, tipoDocumento: '6', numeroDocumento: '20000000010', razonSocial: 'PROVEEDOR DEMO S.A.C.', pais: 'PE',
  esProveedor: true, esCliente: false, direccion: null, activo: true,
}
const nuevo: Tercero = { ...proveedor, id: 9, numeroDocumento: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.' }

const api = crearApiFalsa()

function Prueba() {
  const [tercero, setTercero] = useState<Tercero | null>(null)
  return (
    <>
      <label htmlFor="proveedor">Proveedor</label>
      <SelectorTercero id="proveedor" valor={tercero} alCambiar={setTercero} rol="PROVEEDOR" />
      <output data-testid="elegido">{tercero?.razonSocial ?? 'ninguno'}</output>
    </>
  )
}

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/catalogos', catalogosDemo)
  api.en('GET', '/terceros', { datos: [proveedor], total: 1, pagina: 1, tamano: 20 })
  api.en('GET', '/terceros/validar-documento', { valido: true, numero: '20000000001', codigo: null, mensaje: null, terceroId: null })
  api.en('POST', '/terceros', nuevo)
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

describe('SelectorTercero', () => {
  it('busca en la API por rol y deja elegir un proveedor', async () => {
    renderizarConSesion(<Prueba />)
    const combo = screen.getByRole('combobox', { name: 'Proveedor' })
    expect(combo).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(combo)
    await userEvent.type(screen.getByRole('combobox', { name: 'Buscar proveedor' }), '2000')
    await waitFor(() => expect(api.llamadas.some((l) => l.ruta.includes('q=2000') && l.ruta.includes('rol=PROVEEDOR'))).toBe(true))
    await userEvent.click(await screen.findByRole('option', { name: /PROVEEDOR DEMO S\.A\.C\./ }))
    expect(screen.getByTestId('elegido')).toHaveTextContent('PROVEEDOR DEMO S.A.C.')
    expect(within(screen.getByRole('combobox', { name: /Proveedor/ })).getByText('RUC 20000000010')).toHaveClass('font-mono')
  })

  it('"+ Nuevo" crea el proveedor y lo deja elegido', async () => {
    renderizarConSesion(<Prueba />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Proveedor' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo proveedor' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo cliente o proveedor' })
    expect(within(dialogo).getByRole('checkbox', { name: 'Proveedor' })).toBeChecked()
    await userEvent.type(within(dialogo).getByLabelText('Número de documento'), '20000000001')
    await within(dialogo).findByText('Documento válido.')
    await userEvent.type(within(dialogo).getByLabelText('Razón social o nombre'), 'EMPRESA DEMO S.A.C.')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(screen.getByTestId('elegido')).toHaveTextContent('EMPRESA DEMO S.A.C.'))
  })

  it('CONSULTA no ve "+ Nuevo"', async () => {
    renderizarConSesion(<Prueba />, ['inventario:CONSULTA'])
    await userEvent.click(screen.getByRole('combobox', { name: 'Proveedor' }))
    await screen.findByRole('option', { name: /PROVEEDOR DEMO/ })
    expect(screen.queryByRole('button', { name: 'Nuevo proveedor' })).not.toBeInTheDocument()
  })
})
