import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaLibro131 } from './pagina-libro-13-1'
import { solicitar } from '@/api/cliente'
import { descargarArchivo } from '@/api/descargas'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { productosDemo } from '@/pruebas/comprobantes-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('@/api/descargas', () => ({ descargarArchivo: vi.fn(async (_ruta: string, nombre: string) => nombre) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[], busqueda: string) =>
  renderizarEnRuta(<PaginaLibro131 />, { ruta: `/inventario/libros/13-1${busqueda}`, patron: '/inventario/libros/13-1', roles })

describe('Libro 13.1', () => {
  it('descarga PDF y Excel con los filtros de la URL (todos los productos = sin productoId)', async () => {
    abrir(['inventario:CONSULTA'], '?anio=2026&mes=todo')
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar PDF del libro 13.1 de todo 2026' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith('/libros/13-1?anio=2026&formato=pdf', 'libro-13-1-2026.pdf'))
    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel del libro 13.1 de todo 2026' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith('/libros/13-1?anio=2026&formato=xlsx', 'libro-13-1-2026.xlsx'))
  })

  it('«Detallado» solo para ADMIN y CONTADOR, y se envía detallado=true', async () => {
    abrir(['inventario:CONTADOR'], '?producto=1&anio=2026&mes=3&detallado=1')
    expect(await screen.findByRole('checkbox', { name: 'Detallado' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel del libro 13.1 de Marzo 2026' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith(
      '/libros/13-1?anio=2026&mes=3&productoId=1&detallado=true&formato=xlsx', 'libro-13-1-2026-03-detallado.xlsx',
    ))
  })

  it('ASISTENTE y CONSULTA no ven «Detallado» y nunca lo envían (aunque venga en la URL; la API daría 403)', async () => {
    for (const rol of ['inventario:ASISTENTE', 'inventario:CONSULTA']) {
      const { unmount } = abrir([rol], '?producto=1&anio=2026&mes=3&detallado=1')
      await userEvent.click(await screen.findByRole('button', { name: 'Descargar PDF del libro 13.1 de Marzo 2026' }))
      expect(screen.queryByRole('checkbox', { name: 'Detallado' })).not.toBeInTheDocument()
      await waitFor(() => expect(descargarArchivo).toHaveBeenLastCalledWith('/libros/13-1?anio=2026&mes=3&productoId=1&formato=pdf', 'libro-13-1-2026-03.pdf'))
      unmount()
    }
  })
})
