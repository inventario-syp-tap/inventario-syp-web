import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaControlTonelaje } from './pagina-control-tonelaje'
import { solicitar } from '@/api/cliente'
import { descargarArchivo } from '@/api/descargas'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { controlTonelajeDemo } from '@/pruebas/contabilidad-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('@/api/descargas', () => ({ descargarArchivo: vi.fn(async (_ruta: string, nombre: string) => nombre) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/control-tonelaje', controlTonelajeDemo())
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[] = ['inventario:CONTADOR']) =>
  renderizarEnRuta(<PaginaControlTonelaje />, { ruta: '/inventario/control-tonelaje?anio=2026', patron: '/inventario/control-tonelaje', roles })

const filaDe = (mes: string) => screen.getByRole('rowheader', { name: mes }).closest('tr') as HTMLElement

describe('Control de tonelaje', () => {
  it('tabla de 12 meses con reportado, fuente, compras del kardex, diferencia y observación', async () => {
    abrir(['inventario:CONSULTA'])
    await screen.findByRole('table', { name: /Control de tonelaje 2026/ })
    expect(api.hechas('GET', '/control-tonelaje')[0].ruta).toBe('/control-tonelaje?anio=2026')
    expect(screen.getAllByRole('rowheader')).toHaveLength(12)
    const enero = filaDe('Enero')
    expect(within(enero).getByText('REPORTE EXTERNO')).toBeInTheDocument()
    expect(within(enero).getAllByText('30.0000')).toHaveLength(2)
    expect(within(enero).getByText('Sin diferencia')).toBeInTheDocument()
    expect(within(filaDe('Marzo')).getByText('Sin reporte')).toBeInTheDocument()
  })

  it('las diferencias se resaltan con ícono y el texto "Diferencia" (no solo color), con la observación', async () => {
    abrir(['inventario:CONSULTA'])
    await screen.findByRole('table')
    const febrero = filaDe('Febrero')
    expect(within(febrero).getByText('Diferencia')).toBeInTheDocument()
    expect(within(febrero).getByText('2.0000')).toBeInTheDocument()
    expect(within(febrero).getByText('Compra registrada al mes siguiente')).toBeInTheDocument()
    expect(screen.getByText('1 mes con diferencia en 2026')).toBeInTheDocument()
  })

  it('CONSULTA y ASISTENTE no ven Editar ni Registrar, pero sí descargan el Excel', async () => {
    for (const rol of ['inventario:CONSULTA', 'inventario:ASISTENTE']) {
      const { unmount } = abrir([rol])
      await screen.findByRole('table')
      expect(screen.queryByRole('button', { name: /^Editar el tonelaje/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Registrar el tonelaje/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Descargar Excel del control de tonelaje 2026' })).toBeInTheDocument()
      unmount()
    }
  })

  it('Descargar Excel pide el formato xlsx del año', async () => {
    abrir(['inventario:CONSULTA'])
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar Excel del control de tonelaje 2026' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith('/control-tonelaje?anio=2026&formato=xlsx', 'control-tonelaje-2026.xlsx'))
  })

  it('editar un reporte: la fuente queda fija y se envía PUT con las toneladas como texto y la observación', async () => {
    api.en('PUT', '/control-tonelaje/2026/2', (l: { cuerpo: unknown }) => ({ ...controlTonelajeDemo().meses[1], cuerpo: l.cuerpo }))
    abrir(['inventario:ADMIN'])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar el tonelaje de Febrero 2026 (REPORTE EXTERNO)' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar tonelaje reportado · Febrero 2026' })
    expect(within(dialogo).getByLabelText('Fuente')).toHaveAttribute('readonly')
    const tn = within(dialogo).getByLabelText('Toneladas reportadas (TN)')
    expect(tn).toHaveValue('32.0000')
    await userEvent.clear(tn)
    await userEvent.type(tn, '30,5')
    const observacion = within(dialogo).getByLabelText('Observación (opcional)')
    await userEvent.clear(observacion)
    await userEvent.type(observacion, 'Corrección del reporte')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('PUT', '/control-tonelaje/2026/2')[0]?.cuerpo).toEqual({
      toneladasReportadas: '30.5', fuente: 'REPORTE EXTERNO', observacion: 'Corrección del reporte',
    }))
    expect(toast.success).toHaveBeenCalledWith('Tonelaje reportado de Febrero 2026 guardado')
  })

  it('registrar un mes sin reporte: fuente "REPORTE EXTERNO" por defecto y validación en español', async () => {
    api.en('PUT', '/control-tonelaje/2026/3', controlTonelajeDemo().meses[2])
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar el tonelaje de Marzo 2026' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar tonelaje reportado · Marzo 2026' })
    expect(within(dialogo).getByLabelText('Fuente')).toHaveValue('REPORTE EXTERNO')
    expect(within(dialogo).getByLabelText('Fuente')).not.toHaveAttribute('readonly')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    expect(await within(dialogo).findByText('Indica las toneladas reportadas.')).toBeInTheDocument()
    expect(api.hechas('PUT', '/control-tonelaje/2026/3')).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Toneladas reportadas (TN)'), '12.5')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('PUT', '/control-tonelaje/2026/3')[0]?.cuerpo).toEqual({
      toneladasReportadas: '12.5', fuente: 'REPORTE EXTERNO',
    }))
  })

  it('400 VALIDACION de la API: mensaje junto al campo', async () => {
    api.en('PUT', '/control-tonelaje/2026/3', () => {
      throw new ErrorApi(400, 'VALIDACION', 'x', { campos: { toneladasReportadas: 'Debe ser mayor o igual que 0.' } })
    })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar el tonelaje de Marzo 2026' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Toneladas reportadas (TN)'), '1')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    expect(await within(dialogo).findByText('Debe ser mayor o igual que 0.')).toBeInTheDocument()
  })

  it('error de carga: mensaje y Reintentar', async () => {
    api.en('GET', '/control-tonelaje', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir()
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
