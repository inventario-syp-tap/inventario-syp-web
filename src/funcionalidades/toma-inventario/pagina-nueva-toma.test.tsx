import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaNuevaToma } from './pagina-nueva-toma'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { productosDemo } from '@/pruebas/comprobantes-demo'
import { tomaDemo } from '@/pruebas/contabilidad-demo'
import { periodosAnioDemo } from '@/pruebas/periodos-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-03-31' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
  // Enero y febrero cerrados; marzo abierto.
  api.en('GET', '/periodos', periodosAnioDemo(2026, [1, 2]))
  api.en('POST', '/tomas-inventario', tomaDemo({ id: 'toma-9' }))
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = () => renderizarEnRuta(<PaginaNuevaToma />, {
  ruta: '/inventario/toma-inventario/nueva', patron: '/inventario/toma-inventario/nueva', roles: ['inventario:CONTADOR'],
})

describe('Nueva toma de inventario (pasos 1 y 2)', () => {
  it('paso 1 valida en español el responsable; paso 2 pide la cantidad de cada producto activo', async () => {
    abrir()
    expect(await screen.findByRole('heading', { name: 'Paso 1 de 4: Fecha y responsable' })).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de la toma')).toHaveValue('2026-03-31')
    await userEvent.click(screen.getByRole('button', { name: /Siguiente: cantidades/ }))
    expect(await screen.findByText('Indica quién hizo el conteo (nombre o cargo).')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Responsable del conteo'), 'Contadora (demo)')
    await userEvent.click(screen.getByRole('button', { name: /Siguiente: cantidades/ }))
    const titulo = await screen.findByRole('heading', { name: 'Paso 2 de 4: Cantidades contadas' })
    await waitFor(() => expect(titulo).toHaveFocus())
    // Solo los productos activos (COBRE está inactivo en los datos de prueba).
    expect(screen.getByLabelText('FIERRO · Chatarra de fierro')).toBeInTheDocument()
    expect(screen.getByLabelText('INOXIDABLE · Chatarra inoxidable')).toBeInTheDocument()
    expect(screen.queryByLabelText(/COBRE/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Calcular diferencias' }))
    expect(await screen.findAllByText('Indica la cantidad contada (0 si no hay).')).toHaveLength(2)
    expect(api.hechas('POST', '/tomas-inventario')).toHaveLength(0)
  })

  it('envía fecha, responsable y cantidades como texto y abre el detalle de la toma (pasos 3 y 4)', async () => {
    const { router } = abrir()
    await userEvent.type(await screen.findByLabelText('Responsable del conteo'), 'Contadora (demo)')
    await userEvent.click(screen.getByRole('button', { name: /Siguiente: cantidades/ }))
    await userEvent.type(await screen.findByLabelText('FIERRO · Chatarra de fierro'), '14.75')
    await userEvent.type(screen.getByLabelText('INOXIDABLE · Chatarra inoxidable'), '0')
    await userEvent.click(screen.getByRole('button', { name: 'Calcular diferencias' }))
    await waitFor(() => expect(api.hechas('POST', '/tomas-inventario')[0]?.cuerpo).toEqual({
      fecha: '2026-03-31',
      responsable: 'Contadora (demo)',
      lineas: [{ productoId: 1, cantidadContada: '14.75' }, { productoId: 2, cantidadContada: '0' }],
    }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/inventario/toma-inventario/toma-9'))
  })

  it('mes cerrado: avisa en la fecha y no deja avanzar', async () => {
    abrir()
    const fecha = await screen.findByLabelText('Fecha de la toma')
    await userEvent.clear(fecha)
    await userEvent.type(fecha, '2026-02-28')
    await userEvent.type(screen.getByLabelText('Responsable del conteo'), 'Contadora (demo)')
    expect(await screen.findByText(/Febrero 2026 está cerrado: no se puede registrar una toma en ese mes/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Siguiente: cantidades/ }))
    expect(screen.getByRole('heading', { name: 'Paso 1 de 4: Fecha y responsable' })).toBeInTheDocument()
  })

  it('409 PERIODO_CERRADO de la API: vuelve al paso 1 con el mensaje en la fecha', async () => {
    api.en('POST', '/tomas-inventario', () => { throw new ErrorApi(409, 'PERIODO_CERRADO', 'x', { fecha: '2026-03-31' }) })
    abrir()
    await userEvent.type(await screen.findByLabelText('Responsable del conteo'), 'Contadora (demo)')
    await userEvent.click(screen.getByRole('button', { name: /Siguiente: cantidades/ }))
    await userEvent.type(await screen.findByLabelText('FIERRO · Chatarra de fierro'), '1')
    await userEvent.type(screen.getByLabelText('INOXIDABLE · Chatarra inoxidable'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Calcular diferencias' }))
    expect(await screen.findByRole('heading', { name: 'Paso 1 de 4: Fecha y responsable' })).toBeInTheDocument()
    expect(screen.getByText(/El mes de marzo de 2026 está cerrado/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Fecha de la toma')).toHaveFocus())
  })

  it('Ctrl+Enter avanza del paso 1 y en el paso 2 calcula las diferencias', async () => {
    abrir()
    await userEvent.type(await screen.findByLabelText('Responsable del conteo'), 'Contadora (demo){Control>}{Enter}{/Control}')
    expect(await screen.findByRole('heading', { name: 'Paso 2 de 4: Cantidades contadas' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('FIERRO · Chatarra de fierro'), '1')
    await userEvent.type(screen.getByLabelText('INOXIDABLE · Chatarra inoxidable'), '2{Control>}{Enter}{/Control}')
    await waitFor(() => expect(api.hechas('POST', '/tomas-inventario')).toHaveLength(1))
  })
})
