import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { escribirFiltrosKardex, leerFiltrosKardex } from './filtros-url'
import { PaginaKardex } from './pagina-kardex'
import { solicitar } from '@/api/cliente'
import { descargarArchivo } from '@/api/descargas'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { comprobanteDemo, productosDemo, resultadoDemo } from '@/pruebas/comprobantes-demo'
import { alertaDemo, kardexDemo } from '@/pruebas/periodos-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('@/api/descargas', () => ({ descargarArchivo: vi.fn(async (_ruta: string, nombre: string) => nombre) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-03-25' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
  api.en('GET', '/kardex', kardexDemo())
  api.en('GET', '/kardex/alertas', {
    anio: 2026, totales: {},
    alertas: [alertaDemo(), alertaDemo({ tipo: 'FECHA_FUERA_DE_ORDEN', movimientoId: 'mov-3', documento: 'E001-0000046', mensaje: 'Fecha anterior.' })],
  })
  api.en('GET', '/comprobantes/comp-2', comprobanteDemo({ id: 'comp-2' }))
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[], ruta = '/inventario/kardex?producto=1&anio=2026&mes=3') =>
  renderizarEnRuta(<PaginaKardex />, { ruta, patron: '/inventario/kardex', roles })

const fila = (documento: string) => screen.getByRole('button', { name: new RegExp(`^Ver ${documento}`) }).closest('tr') as HTMLElement

describe('Kardex: filtros en la URL', () => {
  it('lee y escribe producto, año, mes ("todo" = Todo el año) y Detallado', () => {
    expect(leerFiltrosKardex(new URLSearchParams('producto=2&anio=2025&mes=todo&detallado=1')))
      .toEqual({ productoId: 2, anio: 2025, mes: null, detallado: true })
    // Sin mes: el mes en curso si es el año en curso; si no, todo el año.
    expect(leerFiltrosKardex(new URLSearchParams('anio=2026'))).toMatchObject({ productoId: null, mes: 3 })
    expect(leerFiltrosKardex(new URLSearchParams('anio=2025'))).toMatchObject({ mes: null })
    expect(leerFiltrosKardex(new URLSearchParams('mes=13&producto=x'))).toMatchObject({ productoId: null, mes: 3 })
    expect(escribirFiltrosKardex({ productoId: 1, anio: 2026, mes: null, detallado: false }).toString()).toBe('producto=1&anio=2026&mes=todo')
  })

  it('pide a la API el producto, año y mes de la URL; al cambiar el mes actualiza la URL', async () => {
    const { router } = abrir(['inventario:CONSULTA'])
    await screen.findByRole('table', { name: /Kardex de FIERRO · Marzo 2026/ })
    expect(api.hechas('GET', '/kardex')[0].ruta).toBe('/kardex?productoId=1&anio=2026&mes=3')
    await userEvent.selectOptions(screen.getByLabelText('Mes'), 'Todo el año')
    await waitFor(() => expect(router.state.location.search).toBe('?producto=1&anio=2026&mes=todo'))
    await waitFor(() => expect(api.hechas('GET', '/kardex').at(-1)?.ruta).toBe('/kardex?productoId=1&anio=2026'))
  })
})

describe('Kardex: tabla', () => {
  it('muestra los valores de la API con 4 decimales en cantidades, 2 en C.U. y totales, miles y negativos con signo', async () => {
    abrir(['inventario:CONSULTA'])
    await screen.findByRole('table')
    const saldoInicial = screen.getByRole('rowheader', { name: 'SALDO INICIAL' }).closest('tr') as HTMLElement
    expect(within(saldoInicial).getByText('50.0000')).toBeInTheDocument()
    expect(within(saldoInicial).getByText('60.00')).toBeInTheDocument()
    expect(within(saldoInicial).getByText('3,000.00')).toBeInTheDocument()

    const compra = fila('F001-0000123')
    expect(within(compra).getByText('30.0000')).toBeInTheDocument()
    expect(within(compra).getByText('50.00')).toBeInTheDocument()
    expect(within(compra).getByText('1,500.00')).toBeInTheDocument()
    expect(within(compra).getByText('56.25')).toBeInTheDocument()

    // "1234.5" → 1,234.5000 · "69440.625" → 69,440.63 · negativos con signo, ícono y texto
    const segunda = fila('E001-0000046')
    expect(within(segunda).getByText('1,234.5000')).toBeInTheDocument()
    expect(within(segunda).getByText('69,440.63')).toBeInTheDocument()
    expect(within(segunda).getByText('-1,239.5000')).toHaveClass('text-destructive')
    expect(within(segunda).getByText('-69,721.88')).toBeInTheDocument()
    expect(within(segunda).getAllByText('(negativo)').length).toBeGreaterThan(0)

    // Subtotal del mes en negrita con su estado en texto
    const subtotal = screen.getByRole('rowheader', { name: /MARZO/ }).closest('tr') as HTMLElement
    expect(subtotal).toHaveClass('font-semibold')
    expect(within(subtotal).getByText('Abierto')).toBeInTheDocument()
    expect(within(subtotal).getByText('1,319.5000')).toBeInTheDocument()
  })

  it('las alertas se muestran con ícono y texto, y el resumen superior enlaza a cada fila', async () => {
    abrir(['inventario:CONSULTA'])
    await screen.findByRole('table')
    expect(within(fila('E001-0000045')).getByText('Stock negativo')).toBeInTheDocument()
    expect(within(fila('E001-0000046')).getByText('Fecha anterior al movimiento previo')).toBeInTheDocument()

    const resumen = screen.getByText('2 alertas en el kardex de 2026').closest('[role="status"]') as HTMLElement
    expect(within(resumen).getByText('1 stock negativo · 1 fecha anterior al movimiento previo')).toBeInTheDocument()
    const enlace = within(resumen).getByRole('link', { name: 'FIERRO · 20/03/2026 · E001-0000045' })
    expect(enlace).toHaveAttribute('href', '/inventario/kardex?producto=1&anio=2026&mes=3#fila-mov-2')
  })

  it('al seguir el enlace de una alerta, la fila queda resaltada y con el foco', async () => {
    abrir(['inventario:CONSULTA'], '/inventario/kardex?producto=1&anio=2026&mes=3#fila-mov-2')
    await screen.findByRole('table')
    await waitFor(() => expect(fila('E001-0000045')).toHaveFocus())
    expect(fila('E001-0000045')).toHaveAttribute('aria-current', 'true')
  })

  it('clic en una fila abre el panel lateral con el comprobante y el enlace a su detalle', async () => {
    abrir(['inventario:CONSULTA'])
    await screen.findByRole('table')
    await userEvent.click(within(fila('E001-0000045')).getByText('CLIENTE DEMO S.A.C.'))
    const panel = await screen.findByRole('dialog', { name: 'E001-0000045 · 20/03/2026' })
    expect(within(panel).getByRole('link', { name: 'Abrir el comprobante' })).toHaveAttribute('href', '/inventario/comprobantes/comp-2')
    expect(await within(panel).findByRole('table', { name: 'Líneas y efecto en el kardex' })).toBeInTheDocument()
  })

  it('estado vacío sin movimientos y error con Reintentar', async () => {
    api.en('GET', '/kardex', kardexDemo({ meses: [{ ...kardexDemo().meses[0], filas: [] }] }))
    const { unmount } = abrir(['inventario:CONSULTA'])
    expect(await screen.findByText(/Sin movimientos de FIERRO en Marzo 2026/)).toBeInTheDocument()
    unmount()
    api.en('GET', '/kardex', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir(['inventario:CONSULTA'])
    expect(await screen.findByText(/Ocurrió un error inesperado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('Kardex: permisos, reordenar y recalcular', () => {
  it('CONSULTA y ASISTENTE no ven Reordenar ni Recalcular', async () => {
    for (const rol of ['inventario:CONSULTA', 'inventario:ASISTENTE']) {
      const { unmount } = abrir([rol])
      await screen.findByRole('table')
      expect(screen.queryByRole('button', { name: /^(Subir|Bajar) / })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Recalcular' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('CONTADOR reordena solo dentro de la misma fecha; no ve Recalcular', async () => {
    abrir(['inventario:CONTADOR'])
    await screen.findByRole('table')
    // Las dos ventas del 20/03 se pueden intercambiar; la compra del 05/03 no tiene vecinos de su fecha.
    expect(screen.getByRole('button', { name: 'Bajar E001-0000045 del 20/03/2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir E001-0000046 del 20/03/2026' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^(Subir|Bajar) F001-0000123/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subir E001-0000045 del 20/03/2026' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recalcular' })).not.toBeInTheDocument()
  })

  it('en un mes cerrado no se ofrece reordenar', async () => {
    api.en('GET', '/kardex', kardexDemo({ meses: [{ ...kardexDemo().meses[0], estado: 'CERRADO' }] }))
    abrir(['inventario:ADMIN'])
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: /^(Subir|Bajar) / })).not.toBeInTheDocument()
  })

  it('mover pide confirmación explicando el efecto en el costo y envía la dirección', async () => {
    api.en('POST', '/movimientos/mov-3/mover', resultadoDemo(comprobanteDemo()))
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Subir E001-0000046 del 20/03/2026' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Subir E001-0000046' })
    expect(dialogo).toHaveAccessibleDescription(expect.stringContaining('cambia el costo de las salidas de ese día'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Mover' }))
    await waitFor(() => expect(api.hechas('POST', '/movimientos/mov-3/mover')[0]?.cuerpo).toEqual({ direccion: 'ARRIBA' }))
    expect(toast.success).toHaveBeenCalledWith('Orden cambiado · kardex recalculado')
  })

  it('CONFLICTO_CONCURRENTE al mover: "Reintentar" vuelve a cargar el kardex sin reenviar', async () => {
    api.en('POST', '/movimientos/mov-3/mover', () => { throw new ErrorApi(409, 'ORDEN_EN_CONFLICTO', 'x') })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Subir E001-0000046 del 20/03/2026' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Mover' }))
    expect(await screen.findByText('Otro usuario modificó estos datos al mismo tiempo.')).toBeInTheDocument()
    const cargas = api.hechas('GET', '/kardex').length
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.hechas('GET', '/kardex').length).toBeGreaterThan(cargas))
    expect(api.hechas('POST', '/movimientos/mov-3/mover')).toHaveLength(1)
    expect(screen.queryByText('Otro usuario modificó estos datos al mismo tiempo.')).not.toBeInTheDocument()
  })

  it('ADMIN recalcula con confirmación (producto y año elegidos)', async () => {
    api.en('POST', '/kardex/recalcular', { anio: 2026, kardex: 1, filas: 3, filasCambiadas: 0, saldosDesactualizados: [] })
    abrir(['inventario:ADMIN'])
    await userEvent.click(await screen.findByRole('button', { name: 'Recalcular' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Recalcular el kardex' })
    expect(dialogo).toHaveAccessibleDescription(expect.stringContaining('FIERRO · Chatarra de fierro 2026'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Recalcular' }))
    await waitFor(() => expect(api.hechas('POST', '/kardex/recalcular')[0]?.cuerpo).toEqual({ anio: 2026, productoId: 1 }))
    expect(toast.success).toHaveBeenCalledWith('Kardex recalculado: 3 filas, 0 con cambios.', expect.anything())
  })
})

describe('Kardex: PDF 13.1 y Excel', () => {
  it('descargan el libro 13.1 con los mismos filtros; Detallado solo se envía para ADMIN y CONTADOR', async () => {
    const ruta = '/inventario/kardex?producto=1&anio=2026&mes=3&detallado=1'
    const { unmount } = abrir(['inventario:CONTADOR'], ruta)
    await userEvent.click(await screen.findByRole('button', { name: 'PDF 13.1 de FIERRO, Marzo 2026' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith(
      '/libros/13-1?anio=2026&mes=3&productoId=1&detallado=true&formato=pdf', 'libro-13-1-FIERRO-2026-03.pdf',
    ))
    unmount()
    abrir(['inventario:CONSULTA'], ruta)
    await userEvent.click(await screen.findByRole('button', { name: 'Excel del kardex de FIERRO, Marzo 2026' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenLastCalledWith(
      '/libros/13-1?anio=2026&mes=3&productoId=1&formato=xlsx', 'libro-13-1-FIERRO-2026-03.xlsx',
    ))
  })
})
