import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { PaginaTomas } from './pagina-tomas'
import { solicitar } from '@/api/cliente'
import { tomasReemplazadas } from '@/api/tomas-inventario'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { tomaDemo } from '@/pruebas/contabilidad-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))

const api = crearApiFalsa()

const anterior = tomaDemo({ id: 'toma-1', creadoEn: '2026-03-31T20:00:00.000Z' })
const vigente = tomaDemo({ id: 'toma-2', creadoEn: '2026-04-02T15:30:00.000Z' })
const cerrada = tomaDemo({
  id: 'toma-0', fecha: '2026-01-31', creadoEn: '2026-01-31T20:00:00.000Z', estado: 'CERRADA', resuelta: true,
  comprobantes: [{ id: 'comp-7', naturaleza: 'AJUSTE', documento: '00-AI-0001' }],
})

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/tomas-inventario', [vigente, anterior, cerrada])
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[] = ['inventario:CONTADOR']) =>
  renderizarEnRuta(<PaginaTomas />, { ruta: '/inventario/toma-inventario?anio=2026', patron: '/inventario/toma-inventario', roles })

const fila = async (texto: RegExp) => (await screen.findByRole('link', { name: texto })).closest('tr') as HTMLElement

describe('tomasReemplazadas', () => {
  it('marca la toma en BORRADOR que tiene otra posterior con la misma fecha (la más reciente)', () => {
    const otra = tomaDemo({ id: 'toma-3', creadoEn: '2026-04-05T10:00:00.000Z' })
    const mapa = tomasReemplazadas([anterior, vigente, otra, cerrada])
    expect(mapa.get('toma-1')?.id).toBe('toma-3')
    expect(mapa.get('toma-2')?.id).toBe('toma-3')
    expect(mapa.has('toma-3')).toBe(false)
    expect(mapa.has('toma-0')).toBe(false)
  })

  it('no marca una toma CERRADA ni tomas de otra fecha', () => {
    const otraFecha = tomaDemo({ id: 'toma-4', fecha: '2026-04-30', creadoEn: '2026-05-01T10:00:00.000Z' })
    expect(tomasReemplazadas([anterior, otraFecha]).size).toBe(0)
    expect(tomasReemplazadas([{ ...anterior, estado: 'CERRADA' }, vigente]).size).toBe(0)
  })
})

describe('Toma de inventario — lista', () => {
  it('lista las tomas del año con fecha, responsable, diferencias, estado y comprobantes', async () => {
    abrir(['inventario:CONSULTA'])
    const cerradaFila = await fila(/31\/01\/2026/)
    expect(api.hechas('GET', '/tomas-inventario')[0].ruta).toBe('/tomas-inventario?anio=2026')
    expect(within(cerradaFila).getByText('Cerrada')).toBeInTheDocument()
    expect(within(cerradaFila).getByRole('link', { name: 'Ver el ajuste 00-AI-0001' })).toHaveAttribute('href', '/inventario/comprobantes/comp-7')
    expect(within(cerradaFila).getByText('2 de 3')).toBeInTheDocument()
  })

  it('la anterior queda "Reemplazada por la toma del <fecha y hora>" y no se ofrece resolverla', async () => {
    abrir()
    const vieja = await fila(/registrada el 31\/03\/2026/)
    expect(within(vieja).getByText(/^Reemplazada por la toma del 02\/04\/2026/)).toBeInTheDocument()
    expect(within(vieja).getByRole('link', { name: /^Ver la toma/ })).toBeInTheDocument()
    expect(within(vieja).queryByRole('link', { name: /^Resolver/ })).not.toBeInTheDocument()
    const nueva = await fila(/registrada el 02\/04\/2026/)
    expect(within(nueva).getByText('Borrador')).toBeInTheDocument()
    expect(within(nueva).getByRole('link', { name: /^Resolver la toma/ })).toHaveAttribute('href', '/inventario/toma-inventario/toma-2')
  })

  it('CONSULTA y ASISTENTE solo ven (sin Nueva toma ni Resolver)', async () => {
    for (const rol of ['inventario:CONSULTA', 'inventario:ASISTENTE']) {
      const { unmount } = abrir([rol])
      await fila(/registrada el 02\/04\/2026/)
      expect(screen.queryByRole('link', { name: 'Nueva toma' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^Resolver/ })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('ADMIN y CONTADOR ven Nueva toma', async () => {
    abrir(['inventario:ADMIN'])
    expect(await screen.findByRole('link', { name: 'Nueva toma' })).toHaveAttribute('href', '/inventario/toma-inventario/nueva')
  })

  it('vacío con acción y error con Reintentar', async () => {
    api.en('GET', '/tomas-inventario', [])
    const { unmount } = abrir()
    expect(await screen.findByText(/Aún no hay tomas de inventario en 2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar una toma' })).toBeInTheDocument()
    unmount()
    api.en('GET', '/tomas-inventario', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
