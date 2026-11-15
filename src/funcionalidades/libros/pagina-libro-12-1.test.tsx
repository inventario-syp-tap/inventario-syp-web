import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaLibro121 } from './pagina-libro-12-1'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { productosDemo } from '@/pruebas/comprobantes-demo'
import { impresionesDemo, libro121Demo } from '@/pruebas/libros-demo'
import { periodosAnioDemo } from '@/pruebas/periodos-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('@/api/descargas', () => ({ descargarArchivo: vi.fn(async (_ruta: string, nombre: string) => nombre) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-05-10' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
  // Enero y febrero cerrados; marzo en adelante abiertos.
  api.en('GET', '/periodos', periodosAnioDemo(2026, [1, 2]))
  api.en('GET', '/libros/12-1', libro121Demo())
  api.en('GET', '/libros/12-1/impresiones', impresionesDemo())
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[], busqueda = '?anio=2026&mes=1') =>
  renderizarEnRuta(<PaginaLibro121 />, { ruta: `/inventario/libros/12-1${busqueda}`, patron: '/inventario/libros/12-1', roles })

describe('Libro 12.1', () => {
  it('vista previa tipo hoja con las cifras tal como llegan, modo del año y filtros en la consulta', async () => {
    abrir(['inventario:CONSULTA'])
    const hoja = await screen.findByRole('article', { name: 'Libro 12.1 · ENERO--2026 · CH FIERRO' })
    expect(api.hechas('GET', '/libros/12-1')[0].ruta).toBe('/libros/12-1?anio=2026&mes=1')
    expect(screen.getByText('AGRUPADO')).toBeInTheDocument()
    expect(within(hoja).getByText('REGISTRO DEL INVENTARIO PERMANENTE EN UNIDADES FÍSICAS')).toBeInTheDocument()
    expect(within(hoja).getByText('20000000001')).toBeInTheDocument()
    // Cifras sin reformatear: 3 decimales en entradas/salidas, 2 en saldos y totales.
    const venta = within(hoja).getByText('0000045').closest('tr') as HTMLElement
    expect(within(venta).getByText('10.000')).toBeInTheDocument()
    expect(within(venta).getByText('15.00')).toBeInTheDocument()
    const totales = within(hoja).getByRole('rowheader', { name: 'TOTALES' }).closest('tr') as HTMLElement
    expect(within(totales).getByText('25.00')).toBeInTheDocument()
    expect(within(totales).getByText('10.00')).toBeInTheDocument()
  })

  it('año completo y todos los productos: la consulta va sin mes ni producto y pide elegir un mes para el estado', async () => {
    abrir(['inventario:CONTADOR'], '?anio=2026&mes=todo')
    await screen.findByRole('article')
    expect(api.hechas('GET', '/libros/12-1')[0].ruta).toBe('/libros/12-1?anio=2026')
    expect(screen.getByText('Elige un mes para ver su estado de impresión y registrarla.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar impresión' })).not.toBeInTheDocument()
  })

  it('CONSULTA y ASISTENTE: solo Descargar PDF (sin prueba de márgenes ni Registrar impresión)', async () => {
    for (const rol of ['inventario:CONSULTA', 'inventario:ASISTENTE']) {
      const { unmount } = abrir([rol])
      await screen.findByRole('article')
      expect(screen.getByRole('button', { name: 'Descargar PDF del libro 12.1 de Enero 2026' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Página de prueba de márgenes' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Registrar impresión' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('ADMIN y CONTADOR: prueba de márgenes y Registrar impresión con el mes cerrado', async () => {
    for (const rol of ['inventario:ADMIN', 'inventario:CONTADOR']) {
      const { unmount } = abrir([rol])
      expect(await screen.findByRole('button', { name: 'Registrar impresión' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Página de prueba de márgenes' })).toBeInTheDocument()
      unmount()
    }
  })

  it('mes abierto: explica que se imprime después de cerrarlo y no ofrece Registrar impresión', async () => {
    abrir(['inventario:CONTADOR'], '?anio=2026&mes=3')
    expect(await screen.findByText('Marzo 2026 está abierto')).toBeInTheDocument()
    expect(screen.getByText(/se imprime en las hojas legalizadas después de cerrar el mes/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar impresión' })).not.toBeInTheDocument()
    // La prueba de márgenes no depende del mes.
    expect(screen.getByRole('button', { name: 'Página de prueba de márgenes' })).toBeInTheDocument()
  })

  it('estados del mes: Pendiente, ✓ Impreso con fecha y ⚠ Impresión desactualizada', async () => {
    api.en('GET', '/libros/12-1/impresiones', impresionesDemo({
      meses: impresionesDemo().meses.map((m) => m.mes === 1
        ? { ...m, estado: 'IMPRESO', impresoEn: '2026-02-10T15:00:00.000Z' }
        : m.mes === 2 ? { ...m, estado: 'DESACTUALIZADO', impresoEn: '2026-03-02T15:00:00.000Z' } : m),
    }))
    const { unmount } = abrir(['inventario:CONSULTA'], '?anio=2026&mes=1')
    expect(await screen.findByText('Impreso 10/02/2026')).toBeInTheDocument()
    unmount()
    const segunda = abrir(['inventario:CONSULTA'], '?anio=2026&mes=2')
    expect(await screen.findAllByText('Impresión desactualizada: vuelve a imprimir')).not.toHaveLength(0)
    segunda.unmount()
    abrir(['inventario:CONSULTA'], '?anio=2026&mes=3')
    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
  })

  it('Registrar impresión: solo la observación, muestra la fecha de hoy y envía {anio, mes, observacion}', async () => {
    api.en('POST', '/libros/12-1/impresiones', {
      id: 1, anio: 2026, mes: 1, periodo: '2026-01', observacion: 'Hojas 0001 a 0003', impresoEn: '2026-05-10T15:00:00.000Z',
      impresoPor: 'Contadora (demo)', vigente: true, reimpresion: false,
    })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar impresión' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar impresión · Enero 2026' })
    expect(within(dialogo).getByText('10/05/2026')).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText(/Fecha/)).not.toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Observación (opcional)'), 'Hojas 0001 a 0003')
    const consultasAntes = api.hechas('GET', '/periodos').length
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Registrar impresión/ }))
    await waitFor(() => expect(api.hechas('POST', '/libros/12-1/impresiones')[0]?.cuerpo).toEqual({
      anio: 2026, mes: 1, observacion: 'Hojas 0001 a 0003',
    }))
    expect(toast.success).toHaveBeenCalledWith('Impresión del libro 12.1 de Enero 2026 registrada')
    // Se invalidan periodos y el libro 12.1 (estado e historial).
    await waitFor(() => expect(api.hechas('GET', '/periodos').length).toBeGreaterThan(consultasAntes))
    expect(api.hechas('GET', '/libros/12-1/impresiones').length).toBeGreaterThan(1)
  })

  it('Registrar impresión con 409 PERIODO_NO_CERRADO (otro usuario reabrió el mes): mensaje claro en el diálogo', async () => {
    api.en('POST', '/libros/12-1/impresiones', () => { throw new ErrorApi(409, 'PERIODO_NO_CERRADO', 'x') })
    abrir(['inventario:ADMIN'])
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar impresión' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Registrar impresión/ }))
    expect(await within(dialogo).findByText(
      'Enero 2026 no está cerrado: el libro 12.1 se registra como impreso después de cerrar el mes.',
    )).toBeInTheDocument()
    expect(api.hechas('POST', '/libros/12-1/impresiones')[0].cuerpo).toEqual({ anio: 2026, mes: 1 })
  })

  it('si falla el estado del mes (periodos), lo avisa con Reintentar en vez de ocultar la acción en silencio', async () => {
    api.en('GET', '/periodos', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir(['inventario:CONTADOR'])
    expect(await screen.findByText('No pudimos leer el estado del mes')).toBeInTheDocument()
    api.en('GET', '/periodos', periodosAnioDemo(2026, [1, 2]))
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Registrar impresión' })).toBeInTheDocument()
    expect(screen.queryByText('No pudimos leer el estado del mes')).not.toBeInTheDocument()
  })

  it('sin datos: mensaje vacío; error de carga: Reintentar', async () => {
    api.en('GET', '/libros/12-1', libro121Demo({ bloques: [] }))
    const { unmount } = abrir(['inventario:CONSULTA'])
    expect(await screen.findByText('No hay datos del libro 12.1 para Enero 2026.')).toBeInTheDocument()
    unmount()
    api.en('GET', '/libros/12-1', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir(['inventario:CONSULTA'])
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
