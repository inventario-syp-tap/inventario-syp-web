import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaEstablecimientos } from './pagina-establecimientos'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarConSesion } from '@/pruebas/api-falsa'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const local = { id: 1, codigo: '0001', nombre: 'LOCAL DEMO', textoLibro: '0001-LOCAL DEMO', activo: true }
const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/establecimientos', [local])
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

describe('Establecimientos', () => {
  it('CONTADOR ve la lista pero no crea ni edita (solo ADMIN)', async () => {
    renderizarConSesion(<PaginaEstablecimientos />, ['inventario:CONTADOR'])
    expect(await screen.findByText('0001-LOCAL DEMO')).toBeInTheDocument()
    expect(screen.getByText('Solo el administrador crea y edita establecimientos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo establecimiento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('ADMIN crea: propone el texto del libro y muestra 409 ESTABLECIMIENTO_DUPLICADO en el código', async () => {
    api.en('POST', '/establecimientos', () => { throw new ErrorApi(409, 'ESTABLECIMIENTO_DUPLICADO', 'x') })
    renderizarConSesion(<PaginaEstablecimientos />, ['inventario:ADMIN'])
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo establecimiento' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo establecimiento' })
    await userEvent.type(within(dialogo).getByLabelText('Código (4 dígitos)'), '0001')
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'almacen demo')
    expect(within(dialogo).getByText('Si lo dejas vacío: «0001-ALMACEN DEMO».')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('POST', '/establecimientos')).toHaveLength(1))
    // Sin texto del libro: lo arma la API
    expect(api.hechas('POST', '/establecimientos')[0].cuerpo).toEqual({ codigo: '0001', nombre: 'ALMACEN DEMO' })
    await waitFor(() => expect(within(dialogo).getByLabelText('Código (4 dígitos)'))
      .toHaveAccessibleDescription(expect.stringContaining('Ya existe un establecimiento con ese código.')))
  })

  it('ADMIN edita: el código no cambia y se puede desactivar', async () => {
    api.en('PATCH', '/establecimientos/1', { ...local, activo: false })
    renderizarConSesion(<PaginaEstablecimientos />, ['inventario:ADMIN'])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar 0001' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar establecimiento 0001' })
    expect(within(dialogo).getByLabelText('Código (4 dígitos)')).toHaveAttribute('readonly')
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Activo' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('PATCH', '/establecimientos/1')[0]?.cuerpo).toEqual({ activo: false }))
  })
})
