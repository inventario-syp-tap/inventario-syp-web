import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Encabezado } from './encabezado'
import { solicitar } from '@/api/cliente'
import { SidebarProvider } from '@/componentes/ui/sidebar'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { periodosAnioDemo } from '@/pruebas/periodos-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-03-25' }))

const api = crearApiFalsa()

beforeAll(() => {
  // jsdom no trae matchMedia (lo usa el Sidebar para detectar móvil).
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: false, media: consulta, addEventListener: () => {}, removeEventListener: () => {},
  }))
})

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = () => renderizarEnRuta(<SidebarProvider><Encabezado titulo="Kardex" /></SidebarProvider>)

describe('Barra superior: chip del mes en curso', () => {
  it('muestra el estado del mes en curso con texto y enlaza a Periodos', async () => {
    api.en('GET', '/periodos', periodosAnioDemo(2026, [1, 2, 3]))
    abrir()
    const enlace = await screen.findByRole('link', { name: 'Mes en curso: Marzo 2026, Cerrado. Ir a Periodos' })
    expect(enlace).toHaveAttribute('href', '/inventario/periodos')
    expect(enlace).toHaveTextContent('Marzo 2026 ·Cerrado')
    expect(api.hechas('GET', '/periodos')[0].ruta).toBe('/periodos?anio=2026')
  })

  it('si la consulta falla no muestra el chip (la barra sigue funcionando)', async () => {
    api.en('GET', '/periodos', () => { throw new Error('sin red') })
    abrir()
    expect(await screen.findByRole('button', { name: /Menú de usuario/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Mes en curso/ })).not.toBeInTheDocument()
  })
})
