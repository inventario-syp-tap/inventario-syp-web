import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaProductos } from './pagina-productos'
import { solicitar } from '@/api/cliente'
import type { Producto, StockProducto } from '@/api/productos'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { catalogosDemo, crearApiFalsa, renderizarConSesion } from '@/pruebas/api-falsa'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Solo datos de demostración (D-*, cantidades y costos redondos).
const fierro: Producto = {
  id: 1, codigo: 'D-FIERRO', codigoLibro: 'DEMO 001', descripcion: 'CHATARRA DE FIERRO', tipoExistencia: '01',
  unidadMedida: 'TNE', metodoValuacion: '1', cuentaInventario: '201101', cuentaCostoVentas: '691101',
  denominacionContable: 'CHATARRA DE FIERRO (DEMO)', activo: true,
}
const cobre: Producto = { ...fierro, id: 2, codigo: 'D-COBRE', codigoLibro: 'DEMO 003', descripcion: 'CHATARRA DE COBRE' }
const stock = (productoId: number, establecimientoId: number, cantidad: string, alertas: string[] = []): StockProducto => ({
  productoId, codigo: '', descripcion: '', establecimientoId, establecimientoCodigo: '000' + establecimientoId, anio: 2026,
  fechaUltimoMovimiento: '2026-03-15', cantidad, costoTotal: '1000.0000000000', costoUnitario: '100.0000000000', alertas,
})

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/catalogos', catalogosDemo)
  api.en('GET', '/productos', [fierro, cobre])
  api.en('GET', '/establecimientos', [
    { id: 1, codigo: '0001', nombre: 'LOCAL DEMO', textoLibro: '0001-LOCAL DEMO', activo: true },
    { id: 2, codigo: '0002', nombre: 'ALMACEN DEMO', textoLibro: '0002-ALMACEN DEMO', activo: true },
  ])
  api.en('GET', '/productos/stock', ({ ruta }: { ruta: string }) => (ruta.includes('establecimientoId=2')
    ? [stock(1, 2, '2.5000')]
    : [stock(1, 1, '10.0000'), stock(2, 1, '-5.0000', ['STOCK_NEGATIVO'])]))
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const fila = async (codigo: string) => (await screen.findByText(codigo)).closest('tr') as HTMLElement

describe('Productos', () => {
  it('muestra el stock del establecimiento elegido, con negativos marcados con ícono y texto', async () => {
    renderizarConSesion(<PaginaProductos />)
    expect(document.title).toBe('Productos · Inventario S&P')
    // El stock llega después de la lista de productos
    expect(await within(await fila('D-FIERRO')).findByText('10.0000')).toBeInTheDocument()
    expect(within(await fila('D-FIERRO')).getByText('15/03/2026')).toBeInTheDocument()
    const filaCobre = await fila('D-COBRE')
    await waitFor(() => expect(within(filaCobre).getByText('-5.0000')).toBeInTheDocument())
    expect(within(filaCobre).getByText('-5.0000').closest('span')).toHaveClass('text-destructive')
    expect(within(filaCobre).getAllByText(/negativo/i).length).toBeGreaterThan(0)
    expect(within(filaCobre).getByText('Stock negativo')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Establecimiento (stock)'), '2')
    await waitFor(() => expect(within(screen.getByText('D-FIERRO').closest('tr') as HTMLElement).getByText('2.5000')).toBeInTheDocument())
    expect(api.llamadas.some((l) => l.ruta === '/productos/stock?establecimientoId=2')).toBe(true)
  })

  it('al editar, el código queda en solo lectura y no se envía; solo va lo que cambió', async () => {
    api.en('PATCH', '/productos/1', { ...fierro, descripcion: 'CHATARRA PESADA DE FIERRO' })
    renderizarConSesion(<PaginaProductos />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar D-FIERRO' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar producto D-FIERRO' })
    const codigo = within(dialogo).getByLabelText('Código')
    expect(codigo).toHaveAttribute('readonly')
    expect(codigo).toHaveAccessibleDescription('El código no se edita después de crear.')
    const descripcion = within(dialogo).getByLabelText('Descripción')
    await userEvent.clear(descripcion)
    await userEvent.type(descripcion, 'CHATARRA PESADA DE FIERRO')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('PATCH', '/productos/1')).toHaveLength(1))
    expect(api.hechas('PATCH', '/productos/1')[0].cuerpo).toEqual({ descripcion: 'CHATARRA PESADA DE FIERRO' })
  })

  it('crear: valida en español y solo deja el método 1 (promedio ponderado)', async () => {
    renderizarConSesion(<PaginaProductos />)
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo producto' })
    await waitFor(() => expect(within(dialogo).getByRole('option', { name: '2 · PEPS' })).toBeDisabled())
    await userEvent.type(within(dialogo).getByLabelText('Código'), 'd plomo')
    await userEvent.type(within(dialogo).getByLabelText('Cuenta de existencias'), '2')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    expect(await within(dialogo).findByText('Usa solo letras, dígitos y guion.')).toBeInTheDocument()
    expect(within(dialogo).getByText('La cuenta de existencias tiene de 2 a 12 dígitos.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Escribe la descripción.')).toBeInTheDocument()
    expect(api.hechas('POST', '/productos')).toHaveLength(0)
  })

  it('crear: envía el código en mayúsculas y muestra 409 PRODUCTO_DUPLICADO junto al código', async () => {
    api.en('POST', '/productos', () => { throw new ErrorApi(409, 'PRODUCTO_DUPLICADO', 'x') })
    renderizarConSesion(<PaginaProductos />)
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo producto' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo producto' })
    await userEvent.type(within(dialogo).getByLabelText('Código'), 'd-plomo')
    await userEvent.type(within(dialogo).getByLabelText('Código del libro 12.1'), 'DEMO 004')
    await userEvent.type(within(dialogo).getByLabelText('Descripción'), 'CHATARRA DE PLOMO')
    await userEvent.type(within(dialogo).getByLabelText('Denominación contable'), 'CHATARRA PLOMO (DEMO)')
    await userEvent.type(within(dialogo).getByLabelText('Cuenta de existencias'), '201104')
    await userEvent.type(within(dialogo).getByLabelText('Cuenta de costo de ventas'), '691104')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('POST', '/productos')).toHaveLength(1))
    expect(api.hechas('POST', '/productos')[0].cuerpo).toMatchObject({ codigo: 'D-PLOMO', metodoValuacion: '1', tipoExistencia: '01', unidadMedida: 'TNE' })
    await waitFor(() => expect(within(dialogo).getByLabelText('Código')).toHaveAccessibleDescription(expect.stringContaining('Ya existe un producto con ese código.')))
  })

  it('CONTADOR y ADMIN editan; ASISTENTE y CONSULTA solo ven', async () => {
    for (const rol of ['ASISTENTE', 'CONSULTA']) {
      const { unmount } = renderizarConSesion(<PaginaProductos />, [`inventario:${rol}`])
      await fila('D-FIERRO')
      expect(screen.queryByRole('button', { name: 'Nuevo producto' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
      unmount()
    }
    renderizarConSesion(<PaginaProductos />, ['inventario:ADMIN'])
    expect(await screen.findByRole('button', { name: 'Nuevo producto' })).toBeInTheDocument()
  })
})
