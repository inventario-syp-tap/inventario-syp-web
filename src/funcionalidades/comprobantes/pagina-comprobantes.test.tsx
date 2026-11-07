import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaComprobantes } from './pagina-comprobantes'
import { PaginaDetalleComprobante } from './pagina-detalle-comprobante'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { comprobanteDemo, establecimientosDemo, lineaDemo, productosDemo, resultadoDemo, ventaDemo } from '@/pruebas/comprobantes-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = crearApiFalsa()
const compra = comprobanteDemo()
const venta = ventaDemo()
const merma = comprobanteDemo({
  id: 'comp-3', naturaleza: 'MERMA', tipoComprobante: '00', serie: 'IT', numero: '2026', documento: '00-IT-2026', tipoOperacion: '13',
  tercero: null, sustento: 'INFORME TÉCNICO DEMO', lineas: [lineaDemo({ id: 'linea-3', tipoMovimiento: 'SALIDA', tipoOperacion: '13', cantidad: '0.5000' })],
})
const anulada = comprobanteDemo({ id: 'comp-4', numero: '120', estado: 'ANULADO', motivoAnulacion: 'Número equivocado' })

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
  api.en('GET', '/establecimientos', establecimientosDemo)
  api.en('GET', '/comprobantes', { datos: [compra, venta, merma, anulada], total: 4, pagina: 1, tamano: 50 })
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const lista = (roles: string[]) => renderizarEnRuta(<PaginaComprobantes />, { roles })
const fila = (texto: string) => screen.getByText(texto).closest('tr') as HTMLElement

describe('Comprobantes: lista', () => {
  it('muestra documento, tipo, tercero, productos y TN; el anulado con su estado en texto', async () => {
    lista(['inventario:CONTADOR'])
    expect(await screen.findByText('F001-0000123')).toBeInTheDocument()
    expect(within(fila('E001-0000045')).getByText('CLIENTE DEMO S.A.C.')).toBeInTheDocument()
    expect(within(fila('00-IT-2026')).getByText('Merma')).toBeInTheDocument()
    expect(within(fila('F001-0000123')).getByText('10.0000')).toBeInTheDocument()
    const filaAnulada = fila('F001-0000120')
    expect(within(filaAnulada).getByText('Anulado')).toBeInTheDocument()
    expect(within(filaAnulada).getByText('. Motivo: Número equivocado')).toHaveClass('sr-only')
    expect(within(filaAnulada).queryByRole('button', { name: /Anular/ })).not.toBeInTheDocument()
  })

  it('los filtros y la búsqueda van a la API', async () => {
    lista(['inventario:CONTADOR'])
    await screen.findByText('F001-0000123')
    await userEvent.selectOptions(screen.getByLabelText('Naturaleza'), 'VENTA')
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'ANULADO')
    await userEvent.type(screen.getByRole('searchbox'), 'F001')
    await waitFor(() => expect(api.llamadas.some((l) =>
      l.ruta.startsWith('/comprobantes?') && l.ruta.includes('naturaleza=VENTA') && l.ruta.includes('estado=ANULADO') && l.ruta.includes('q=F001'))).toBe(true))
  })

  it('el filtro Tercero muestra un texto corto y conserva el completo como descripción', async () => {
    lista(['inventario:CONTADOR'])
    await screen.findByText('F001-0000123')
    const tercero = screen.getByRole('combobox', { name: 'Tercero' })
    expect(tercero).toHaveTextContent('RUC o razón social')
    expect(tercero).not.toHaveTextContent('Buscar')
    expect(tercero).toHaveAccessibleDescription('Buscar cliente o proveedor por RUC o razón social')
    expect(within(tercero).getByText('RUC o razón social')).toHaveClass('truncate')
  })

  it('CONSULTA solo ve "Ver"', async () => {
    lista(['inventario:CONSULTA'])
    await screen.findByText('F001-0000123')
    expect(screen.getAllByRole('button', { name: /^Ver / })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Anular / })).not.toBeInTheDocument()
  })

  it('ASISTENTE edita solo compras y ventas y no anula', async () => {
    lista(['inventario:ASISTENTE'])
    await screen.findByText('F001-0000123')
    expect(screen.getByRole('button', { name: 'Editar F001-0000123' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar E001-0000045' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar 00-IT-2026' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Anular / })).not.toBeInTheDocument()
  })

  it('"Ver" abre el panel con las líneas y su efecto en el kardex', async () => {
    lista(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Ver F001-0000123' }))
    const panel = await screen.findByRole('dialog', { name: 'Compra F001-0000123' })
    const tabla = within(panel).getByRole('table', { name: 'Líneas y efecto en el kardex' })
    expect(within(tabla).getByText('Chatarra pesada')).toBeInTheDocument()
    expect(within(tabla).getAllByText('S/ 1,000.00')).toHaveLength(2)
    expect(within(panel).getByRole('link', { name: 'Abrir el comprobante' })).toHaveAttribute('href', '/inventario/comprobantes/comp-1')
  })

  it('anular exige motivo y lo envía; con stock negativo pide confirmación y reenvía', async () => {
    api.en('POST', '/comprobantes/comp-1/anular', (l: { cuerpo: { confirmarStockNegativo?: boolean } }) => {
      if (!l.cuerpo.confirmarStockNegativo) {
        throw new ErrorApi(409, 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION', 'x',
          { productoId: 1, fecha: '2026-03-20', saldoResultante: '-2.5000', disponibleAntes: '7.5000' })
      }
      return resultadoDemo({ ...compra, estado: 'ANULADO', motivoAnulacion: 'Factura duplicada' })
    })
    lista(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Anular F001-0000123' }))
    const confirmar = await screen.findByRole('alertdialog', { name: 'Anular F001-0000123' })
    expect(confirmar).toHaveAccessibleDescription(expect.stringContaining('se recalculará el kardex de FIERRO 2026'))
    await userEvent.click(within(confirmar).getByRole('button', { name: 'Anular' }))
    expect(within(confirmar).getByLabelText('Motivo')).toHaveAccessibleDescription('Escribe el motivo.')
    await userEvent.type(within(confirmar).getByLabelText('Motivo'), 'Factura duplicada')
    await userEvent.click(within(confirmar).getByRole('button', { name: 'Anular' }))
    const stock = await screen.findByRole('alertdialog', { name: 'El stock quedará en negativo' })
    await userEvent.click(within(stock).getByRole('button', { name: 'Registrar de todos modos' }))
    await waitFor(() => expect(api.hechas('POST', '/comprobantes/comp-1/anular')).toHaveLength(2))
    expect(api.hechas('POST', '/comprobantes/comp-1/anular').map((l) => l.cuerpo)).toEqual([
      { motivo: 'Factura duplicada' },
      { motivo: 'Factura duplicada', confirmarStockNegativo: true },
    ])
    expect(toast.success).toHaveBeenCalledWith('Compra F001-0000123 anulada · kardex recalculado')
    // El botón «Anular» de la fila ya no existe: el foco queda en el título de la página.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Comprobantes', level: 1 })).toHaveFocus())
  })

  it('error al cargar: mensaje y Reintentar', async () => {
    api.en('GET', '/comprobantes', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    lista(['inventario:CONTADOR'])
    expect(await screen.findByText(/Ocurrió un error inesperado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('Detalle y edición', () => {
  const detalle = (id: string, roles: string[], editar = false) =>
    renderizarEnRuta(<PaginaDetalleComprobante />, {
      ruta: `/inventario/comprobantes/${id}${editar ? '?editar=1' : ''}`, patron: '/inventario/comprobantes/:id', roles,
    })

  it('editar envía solo lo que cambió (PATCH) y vuelve al detalle', async () => {
    api.en('GET', '/comprobantes/comp-1', compra)
    api.en('PATCH', '/comprobantes/comp-1', resultadoDemo({ ...compra, numero: '124' }))
    const { router } = detalle('comp-1', ['inventario:CONTADOR'], true)
    const numero = await screen.findByLabelText('Número')
    expect(screen.getByLabelText('Establecimiento')).toBeDisabled()
    await userEvent.clear(numero)
    await userEvent.type(numero, '124')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('PATCH', '/comprobantes/comp-1')[0]?.cuerpo).toEqual({ numero: '124' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(toast.success).toHaveBeenCalledWith('Compra F001-0000124 actualizada · kardex recalculado', expect.anything())
  })

  it('ASISTENTE que edita algo que no registró: 403 con mensaje propio', async () => {
    api.en('GET', '/comprobantes/comp-2', venta)
    api.en('PATCH', '/comprobantes/comp-2', () => { throw new ErrorApi(403, 'SIN_PERMISO', 'x') })
    detalle('comp-2', ['inventario:ASISTENTE'], true)
    const numero = await screen.findByLabelText('Número')
    await userEvent.type(numero, '6')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Solo puedes editar las compras y ventas que registraste tú.')).toBeInTheDocument()
  })

  it('409 COMPROBANTE_ANULADO al editar: aviso y formulario en solo lectura', async () => {
    api.en('GET', '/comprobantes/comp-1', compra)
    api.en('PATCH', '/comprobantes/comp-1', () => { throw new ErrorApi(409, 'COMPROBANTE_ANULADO', 'x') })
    detalle('comp-1', ['inventario:CONTADOR'], true)
    await userEvent.type(await screen.findByLabelText('Número'), '9')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Ese comprobante está anulado: ya no se puede editar ni mover.')).toBeInTheDocument()
    expect(screen.getByLabelText('Número')).toBeDisabled()
    // Guardar queda bloqueado con aria-disabled (sin perder el foco) y el foco pasa al aviso del encabezado.
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('aria-disabled', 'true')
    await waitFor(() => expect(screen.getByText('Ese comprobante está anulado: ya no se puede editar ni mover.')
      .closest('[tabindex="-1"]')).toHaveFocus())
  })

  it('al guardar la edición el foco vuelve a «Editar»', async () => {
    api.en('GET', '/comprobantes/comp-1', compra)
    api.en('PATCH', '/comprobantes/comp-1', resultadoDemo({ ...compra, numero: '124' }))
    detalle('comp-1', ['inventario:CONTADOR'], true)
    const numero = await screen.findByLabelText('Número')
    await userEvent.clear(numero)
    await userEvent.type(numero, '124')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar' })).toHaveFocus())
  })

  it('un anulado no muestra Editar ni Anular y explica el motivo', async () => {
    api.en('GET', '/comprobantes/comp-4', anulada)
    detalle('comp-4', ['inventario:ADMIN'])
    expect(await screen.findByRole('note')).toHaveTextContent('Motivo: Número equivocado')
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
  })

  it('NO_ENCONTRADO: mensaje y enlace de vuelta', async () => {
    api.en('GET', '/comprobantes/no-existe', () => { throw new ErrorApi(404, 'NO_ENCONTRADO', 'x') })
    detalle('no-existe', ['inventario:CONSULTA'])
    expect(await screen.findByText('No encontramos ese registro (quizá fue anulado).')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Comprobantes' })).toHaveAttribute('href', '/inventario/comprobantes')
  })
})
