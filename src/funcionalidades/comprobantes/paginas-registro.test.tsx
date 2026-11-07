import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaAjuste, PaginaCompra, PaginaMerma, PaginaVenta } from './paginas-registro'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import {
  clienteDemo, comprobanteDemo, establecimientosDemo, productosDemo, proveedorDemo, resultadoDemo, ventaDemo,
} from '@/pruebas/comprobantes-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-03-15' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
  api.en('GET', '/establecimientos', establecimientosDemo)
  api.en('GET', '/terceros', (l: { ruta: string }) => ({
    datos: l.ruta.includes('rol=CLIENTE') ? [clienteDemo] : [proveedorDemo], total: 1, pagina: 1, tamano: 20,
  }))
  api.en('POST', '/comprobantes/simular-salida', {
    productoId: 1, establecimientoId: 1, fecha: '2026-03-15', cantidad: '2.5', disponibleAntes: '25', costoUnitarioEstimado: '100',
    costoEstimado: '250', saldoResultante: '22.5', quedaNegativo: false,
  })
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const ruta = { ruta: '/nueva', patron: '/nueva' }

async function elegirTercero(etiqueta: 'Proveedor' | 'Cliente', nombre: RegExp) {
  await userEvent.click(await screen.findByRole('combobox', { name: etiqueta }))
  await userEvent.click(await screen.findByRole('option', { name: nombre }))
}

async function llenarLinea(n: number, { producto, descripcion, cantidad, precio }: { producto: string; descripcion: string; cantidad: string; precio?: string }) {
  await userEvent.selectOptions(screen.getByLabelText(`Producto de la línea ${n}`), producto)
  await userEvent.type(screen.getByLabelText(`Descripción de la línea ${n}`), descripcion)
  await userEvent.type(screen.getByLabelText(`Cantidad en TN de la línea ${n}`), cantidad)
  if (precio !== undefined) await userEvent.type(screen.getByLabelText(new RegExp(`línea ${n}$`, 'u'), { selector: 'input[inputmode="decimal"]:not([id$="cantidad"])' }), precio)
}

async function llenarCompra() {
  await elegirTercero('Proveedor', /PROVEEDOR DEMO S\.A\.C\./)
  await userEvent.type(screen.getByLabelText('Serie'), 'F001')
  await userEvent.type(screen.getByLabelText('Número'), '123')
  await llenarLinea(1, { producto: 'FIERRO · Chatarra de fierro', descripcion: 'Chatarra pesada', cantidad: '10', precio: '100' })
}

describe('Registrar compra', () => {
  it('varias líneas con Alt+N, totales de vista previa y envío con decimales como string', async () => {
    api.en('POST', '/comprobantes/compras', resultadoDemo(comprobanteDemo()))
    const { router } = renderizarEnRuta(<PaginaCompra />, ruta)
    await llenarCompra()
    await userEvent.keyboard('{Alt>}n{/Alt}')
    expect(screen.getByLabelText('Producto de la línea 2')).toHaveFocus()
    await llenarLinea(2, { producto: 'INOXIDABLE · Chatarra inoxidable', descripcion: 'Chatarra inox B', cantidad: '2,5', precio: '1000' })
    expect(screen.getByText(/Total 12\.5000 TN/).closest('p')).toHaveTextContent('Total 12.5000 TN · S/ 3,500.00 (vista previa')
    // El producto inactivo no se ofrece
    expect(within(screen.getByLabelText('Producto de la línea 1')).queryByRole('option', { name: /COBRE/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('POST', '/comprobantes/compras')).toHaveLength(1))
    expect(api.hechas('POST', '/comprobantes/compras')[0].cuerpo).toEqual({
      fecha: '2026-03-15', establecimientoId: 1, serie: 'F001', numero: '123', terceroId: 10, tipoComprobante: '01',
      lineas: [
        { productoId: 1, descripcion: 'Chatarra pesada', cantidad: '10', costoUnitario: '100' },
        { productoId: 2, descripcion: 'Chatarra inox B', cantidad: '2.5', costoUnitario: '1000' },
      ],
    })
    expect(toast.success).toHaveBeenCalledWith('Compra F001-0000123 registrada · kardex recalculado', expect.objectContaining({ action: expect.anything() }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/inventario/comprobantes/comp-1'))
  })

  it('valida en español antes de enviar y no llama a la API', async () => {
    renderizarEnRuta(<PaginaCompra />, ruta)
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Elige el proveedor.')).toBeInTheDocument()
    expect(screen.getByLabelText('Producto de la línea 1')).toHaveAccessibleDescription('Elige el producto.')
    expect(api.hechas('POST', '/comprobantes/compras')).toHaveLength(0)
    // El foco va al primer campo con error: el combobox del proveedor.
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Proveedor' })).toHaveFocus())
  })

  it('al quitar una línea el foco pasa al producto de la línea que queda en su lugar', async () => {
    renderizarEnRuta(<PaginaCompra />, ruta)
    await userEvent.click(await screen.findByRole('button', { name: /Agregar línea/ }))
    await userEvent.click(screen.getByRole('button', { name: /Agregar línea/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Quitar la línea 2' }))
    expect(screen.queryByLabelText('Producto de la línea 3')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Producto de la línea 2')).toHaveFocus())
  })

  it('409 COMPROBANTE_DUPLICADO se muestra junto al número', async () => {
    api.en('POST', '/comprobantes/compras', () => { throw new ErrorApi(409, 'COMPROBANTE_DUPLICADO', 'x') })
    renderizarEnRuta(<PaginaCompra />, ruta)
    await llenarCompra()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByLabelText('Número'))
      .toHaveAccessibleDescription('Ya existe la factura F001-0000123 de este proveedor.'))
  })

  it('409 PERIODO_CERRADO: aviso en el encabezado con el mes y error en la fecha', async () => {
    api.en('POST', '/comprobantes/compras', () => { throw new ErrorApi(409, 'PERIODO_CERRADO', 'x') })
    renderizarEnRuta(<PaginaCompra />, ruta)
    await llenarCompra()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText(
      'El mes de marzo de 2026 está cerrado: no se puede registrar ni modificar. Pide reabrirlo si necesitas cambiarlo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de emisión')).toHaveAccessibleDescription('Ese mes está cerrado.')
  })

  it('409 ORDEN_EN_CONFLICTO: "Reintentar" reenvía lo mismo', async () => {
    let intentos = 0
    api.en('POST', '/comprobantes/compras', () => {
      intentos += 1
      if (intentos === 1) throw new ErrorApi(409, 'ORDEN_EN_CONFLICTO', 'x')
      return resultadoDemo(comprobanteDemo())
    })
    renderizarEnRuta(<PaginaCompra />, ruta)
    await llenarCompra()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Otro usuario modificó este kardex al mismo tiempo; vuelve a intentarlo.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.hechas('POST', '/comprobantes/compras')).toHaveLength(2))
    const [primero, segundo] = api.hechas('POST', '/comprobantes/compras')
    expect(segundo.cuerpo).toEqual(primero.cuerpo)
  })

  it('"Guardar y nueva" limpia el formulario y conserva la fecha', async () => {
    api.en('POST', '/comprobantes/compras', resultadoDemo(comprobanteDemo()))
    const { router } = renderizarEnRuta(<PaginaCompra />, ruta)
    await llenarCompra()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar y nueva' }))
    await waitFor(() => expect(screen.getByLabelText('Serie')).toHaveValue(''))
    expect(screen.getByLabelText('Fecha de emisión')).toHaveValue('2026-03-15')
    expect(router.state.location.pathname).toBe('/nueva')
  })
})

describe('Registrar venta o exportación', () => {
  it('con boleta (03) la operación queda en 01 Nacional y 17 se deshabilita', async () => {
    renderizarEnRuta(<PaginaVenta />, ruta)
    const operacion = await screen.findByLabelText('Operación')
    await userEvent.selectOptions(operacion, '17')
    await userEvent.selectOptions(screen.getByLabelText('Comprobante'), '03')
    expect(operacion).toHaveValue('01')
    expect(within(operacion).getByRole('option', { name: '17 · Exportación' })).toBeDisabled()
    expect(operacion).toHaveAccessibleDescription('La exportación requiere factura.')
  })

  it('exportación en USD: pide tipo de cambio, simula la salida y envía strings', async () => {
    api.en('POST', '/comprobantes/ventas', resultadoDemo(ventaDemo({ tipoOperacion: '17', moneda: 'USD', tipoCambio: '3.750' })))
    renderizarEnRuta(<PaginaVenta />, ruta)
    await elegirTercero('Cliente', /CLIENTE DEMO S\.A\.C\./)
    await userEvent.selectOptions(screen.getByLabelText('Operación'), '17')
    await userEvent.selectOptions(screen.getByLabelText('Moneda'), 'USD')
    await userEvent.type(screen.getByLabelText('Serie'), 'E001')
    await userEvent.type(screen.getByLabelText('Número'), '45')
    await llenarLinea(1, { producto: 'FIERRO · Chatarra de fierro', descripcion: 'Chatarra pesada', cantidad: '2.5', precio: '900' })
    expect(await screen.findByText(/Disponible al 15\/03\/2026: 25\.0000 TN · costo\s+estimado S\/ 250\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Total 2\.5000 TN/).closest('p')).toHaveTextContent('US$ 2,250.00')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByLabelText('Tipo de cambio')).toHaveAccessibleDescription(expect.stringContaining('Indica el tipo de cambio'))
    await userEvent.type(screen.getByLabelText('Tipo de cambio'), '3.750')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('POST', '/comprobantes/ventas')).toHaveLength(1))
    expect(api.hechas('POST', '/comprobantes/ventas')[0].cuerpo).toMatchObject({
      tipoComprobante: '01', tipoOperacion: '17', moneda: 'USD', tipoCambio: '3.750', terceroId: 28,
      lineas: [{ productoId: 1, descripcion: 'Chatarra pesada', cantidad: '2.5', valorVentaUnitario: '900' }],
    })
    expect(toast.success).toHaveBeenCalledWith('Exportación E001-0000045 registrada · kardex recalculado', expect.anything())
  })

  it('409 STOCK_NEGATIVO_REQUIERE_CONFIRMACION: diálogo y reenvío con la confirmación', async () => {
    api.en('POST', '/comprobantes/ventas', (l: { cuerpo: { confirmarStockNegativo?: boolean } }) => {
      if (!l.cuerpo.confirmarStockNegativo) {
        throw new ErrorApi(409, 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION', 'x',
          { productoId: 1, fecha: '2026-03-15', saldoResultante: '-5.0000', disponibleAntes: '40.0000' })
      }
      return resultadoDemo(ventaDemo())
    })
    renderizarEnRuta(<PaginaVenta />, ruta)
    await elegirTercero('Cliente', /CLIENTE DEMO/)
    await userEvent.type(screen.getByLabelText('Serie'), 'E001')
    await userEvent.type(screen.getByLabelText('Número'), '45')
    await llenarLinea(1, { producto: 'FIERRO · Chatarra de fierro', descripcion: 'Chatarra pesada', cantidad: '45', precio: '900' })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'El stock quedará en negativo' })
    expect(dialogo).toHaveAccessibleDescription(expect.stringContaining('FIERRO · Chatarra de fierro en -5.0000 TN al 15/03/2026'))
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar de todos modos' }))
    await waitFor(() => expect(api.hechas('POST', '/comprobantes/ventas')).toHaveLength(2))
    const [primero, segundo] = api.hechas('POST', '/comprobantes/ventas')
    expect(segundo.cuerpo).toEqual({ ...(primero.cuerpo as object), confirmarStockNegativo: true })
  })

  it('409 STOCK_INSUFICIENTE (BLOQUEAR): mensaje claro y sin opción de confirmar', async () => {
    api.en('POST', '/comprobantes/ventas', () => {
      throw new ErrorApi(409, 'STOCK_INSUFICIENTE', 'x', { productoId: 1, fecha: '2026-03-15', disponibleAntes: '40' })
    })
    renderizarEnRuta(<PaginaVenta />, ruta)
    await elegirTercero('Cliente', /CLIENTE DEMO/)
    await userEvent.type(screen.getByLabelText('Serie'), 'E001')
    await userEvent.type(screen.getByLabelText('Número'), '45')
    await llenarLinea(1, { producto: 'FIERRO · Chatarra de fierro', descripcion: 'x', cantidad: '45', precio: '900' })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay stock suficiente de FIERRO · Chatarra de fierro al 15/03/2026 (disponible 40.0000 TN).')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('422 PRECIO_VENTA_REQUERIDO se marca en la línea', async () => {
    api.en('POST', '/comprobantes/ventas', () => { throw new ErrorApi(422, 'PRECIO_VENTA_REQUERIDO', 'x', { linea: 0 }) })
    renderizarEnRuta(<PaginaVenta />, ruta)
    await elegirTercero('Cliente', /CLIENTE DEMO/)
    await userEvent.type(screen.getByLabelText('Serie'), 'E001')
    await userEvent.type(screen.getByLabelText('Número'), '45')
    await llenarLinea(1, { producto: 'FIERRO · Chatarra de fierro', descripcion: 'x', cantidad: '1', precio: '0' })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByLabelText(/Valor de venta S\/ x TN \(sin IGV\), línea 1/))
      .toHaveAccessibleDescription('Indica el valor de venta sin IGV.'))
  })
})

describe('Registrar merma o desmedro', () => {
  it('merma 13: muestra el documento 00-IT-<año>, exige sustento y envía el año del informe', async () => {
    api.en('POST', '/comprobantes/mermas', resultadoDemo(comprobanteDemo({ naturaleza: 'MERMA', tipoComprobante: '00', tipoOperacion: '13', documento: '00-IT-2026' })))
    renderizarEnRuta(<PaginaMerma />, ruta)
    expect(await screen.findByLabelText('Año del informe técnico')).toHaveAccessibleDescription('Documento: 00-IT-2026')
    await llenarLinea(1, { producto: 'FIERRO · Chatarra de fierro', descripcion: 'Merma por oxidación', cantidad: '0.5' })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByLabelText('Sustento')).toHaveAccessibleDescription(expect.stringContaining('Indica el sustento'))
    await userEvent.type(screen.getByLabelText('Sustento'), 'INFORME TÉCNICO DE MERMA DEMO')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('POST', '/comprobantes/mermas')[0]?.cuerpo).toEqual({
      fecha: '2026-03-15', establecimientoId: 1, tipoOperacion: '13', anioInforme: 2026, sustento: 'INFORME TÉCNICO DE MERMA DEMO',
      lineas: [{ productoId: 1, descripcion: 'Merma por oxidación', cantidad: '0.5' }],
    }))
  })

  it('desmedro 14: el documento lo asigna la API y el sustento es el acta', async () => {
    renderizarEnRuta(<PaginaMerma />, ruta)
    await userEvent.selectOptions(await screen.findByLabelText('Tipo'), '14')
    expect(screen.queryByLabelText('Año del informe técnico')).not.toBeInTheDocument()
    expect(screen.getByText('El documento lo asigna la API (00-AD-…, correlativo del año).')).toBeInTheDocument()
    expect(screen.getByLabelText('Sustento')).toHaveAccessibleDescription(expect.stringContaining('Acta de destrucción'))
  })
})

describe('Registrar ajuste', () => {
  it('entrada con costo informado y salida al promedio', async () => {
    api.en('POST', '/comprobantes/ajustes', resultadoDemo(comprobanteDemo({ naturaleza: 'AJUSTE', tipoComprobante: '00', tipoOperacion: '28', documento: '00-AI-0001' })))
    renderizarEnRuta(<PaginaAjuste />, ruta)
    await userEvent.type(await screen.findByLabelText('Sustento'), 'ACTA DE TOMA DE INVENTARIO DEMO')
    await userEvent.selectOptions(screen.getByLabelText('Producto de la línea 1'), 'FIERRO · Chatarra de fierro')
    await userEvent.type(screen.getByLabelText('Descripción de la línea 1'), 'Sobrante')
    await userEvent.type(screen.getByLabelText('Cantidad en TN de la línea 1'), '1')
    expect(screen.queryByLabelText(/Costo S\/ x TN, línea 1/)).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Valorización de la entrada de la línea 1'), 'Con costo informado')
    await userEvent.type(screen.getByLabelText(/Costo S\/ x TN, línea 1/), '100')
    await userEvent.click(screen.getByRole('button', { name: /Agregar línea/ }))
    await userEvent.selectOptions(screen.getByLabelText('Producto de la línea 2'), 'INOXIDABLE · Chatarra inoxidable')
    await userEvent.type(screen.getByLabelText('Descripción de la línea 2'), 'Faltante')
    await userEvent.type(screen.getByLabelText('Cantidad en TN de la línea 2'), '2')
    await userEvent.selectOptions(screen.getByLabelText('Movimiento de la línea 2'), 'Salida')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('POST', '/comprobantes/ajustes')[0]?.cuerpo).toEqual({
      fecha: '2026-03-15', establecimientoId: 1, sustento: 'ACTA DE TOMA DE INVENTARIO DEMO',
      lineas: [
        { productoId: 1, descripcion: 'Sobrante', cantidad: '1', tipoMovimiento: 'ENTRADA', costoUnitario: '100' },
        { productoId: 2, descripcion: 'Faltante', cantidad: '2', tipoMovimiento: 'SALIDA' },
      ],
    }))
    expect(toast.success).toHaveBeenCalledWith('Ajuste 00-AI-0001 registrado · kardex recalculado', expect.anything())
  })
})
