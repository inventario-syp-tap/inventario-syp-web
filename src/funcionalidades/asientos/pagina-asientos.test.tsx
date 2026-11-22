import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaAsientos } from './pagina-asientos'
import { solicitar } from '@/api/cliente'
import { descargarArchivoPost } from '@/api/descargas'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { asientoDemo, asientosMesDemo, exportadoDemo, exportadosDemo } from '@/pruebas/contabilidad-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('@/api/descargas', () => ({
  descargarArchivo: vi.fn(async (_ruta: string, nombre: string) => nombre),
  descargarArchivoPost: vi.fn(async (_ruta: string, _cuerpo: unknown, nombre: string) => nombre),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-05-10' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/asientos', asientosMesDemo())
  api.en('GET', '/asientos/exportados', exportadosDemo())
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[] = ['inventario:CONTADOR'], busqueda = '?anio=2026&mes=1') =>
  renderizarEnRuta(<PaginaAsientos />, { ruta: `/inventario/asientos${busqueda}`, patron: '/inventario/asientos', roles })

const seccion = (nombre: string) => screen.findByRole('region', { name: nombre })

describe('Asientos y WinConta', () => {
  it('consulta el mes de la URL y muestra la tabla Cuenta · Debe · Haber con totales y "cuadra"', async () => {
    abrir()
    const costo = await seccion('Costo de ventas')
    expect(api.hechas('GET', '/asientos')[0].ruta).toBe('/asientos?anio=2026&mes=1')
    expect(within(costo).getByText('PROVISION COSTO DE VENTAS ENERO 2026')).toBeInTheDocument()
    const tabla = within(costo).getByRole('table', { name: /Asiento de costo de ventas de Enero 2026/ })
    const debe = within(tabla).getByRole('rowheader', { name: '691101' }).closest('tr') as HTMLElement
    expect(within(debe).getAllByRole('cell')[0]).toHaveTextContent('600.00')
    expect(within(debe).getAllByRole('cell')[1]).toHaveTextContent('')
    const haber = within(tabla).getByRole('rowheader', { name: '201101' }).closest('tr') as HTMLElement
    expect(within(haber).getAllByRole('cell')[1]).toHaveTextContent('600.00')
    const totales = within(tabla).getByRole('rowheader', { name: 'Totales' }).closest('tr') as HTMLElement
    expect(within(totales).getAllByText('600.00')).toHaveLength(2)
    expect(within(costo).getByText('Cuadra: Debe y Haber son iguales.')).toBeInTheDocument()
    expect(screen.getByText('Cerrado')).toBeInTheDocument()
  })

  it('sin mes en la URL usa el mes en curso', async () => {
    abrir(['inventario:CONSULTA'], '?anio=2026')
    await seccion('Costo de ventas')
    expect(api.hechas('GET', '/asientos')[0].ruta).toBe('/asientos?anio=2026&mes=5')
  })

  it('«Reglas aplicadas» se despliega con la regla, el producto, la operación y las cuentas', async () => {
    abrir()
    const costo = await seccion('Costo de ventas')
    await userEvent.click(within(costo).getByText('Reglas aplicadas (1)'))
    const reglas = within(costo).getByRole('table', { name: /Reglas contables aplicadas/ })
    expect(within(reglas).getByText('RD-01')).toBeInTheDocument()
    expect(within(reglas).getByText('FIERRO')).toBeInTheDocument()
  })

  it('falta regla contable: lista los movimientos, enlaza a Reglas contables y bloquea solo ese tipo', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: /Desmedros/ }))
    const desmedro = await seccion('Desmedro')
    expect(within(desmedro).getByText('Falta regla contable: 1 movimiento sin regla')).toBeInTheDocument()
    expect(within(desmedro).getByText(/20\/01\/2026/)).toHaveTextContent('00-AD-0001')
    expect(within(desmedro).getByRole('link', { name: 'Configurar reglas contables' })).toHaveAttribute('href', '/inventario/maestros/reglas-contables')
    expect(within(desmedro).getByText(/no se puede exportar este tipo hasta configurarla/)).toBeInTheDocument()
    expect(within(desmedro).getByRole('button', { name: /Exportar a WinConta/ })).toBeDisabled()
    // La pestaña avisa con ícono y texto para lectores de pantalla.
    expect(screen.getByRole('tab', { name: /^Desmedros\s*\(falta regla contable\)$/ })).toBeInTheDocument()
    // Los demás tipos siguen exportables.
    await userEvent.click(screen.getByRole('tab', { name: 'Costo de ventas' }))
    expect(within(await seccion('Costo de ventas')).getByRole('button', { name: /Exportar a WinConta/ })).toBeEnabled()
  })

  it('Ajustes reúne faltante y sobrante; un tipo sin líneas lo dice y no se exporta', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('tab', { name: 'Ajustes' }))
    expect(await seccion('Ajuste faltante')).toBeInTheDocument()
    const sobrante = await seccion('Ajuste sobrante')
    expect(within(sobrante).getByText('Sin líneas de ajuste sobrante en Enero 2026.')).toBeInTheDocument()
    expect(within(sobrante).getByText('No hay movimientos de este tipo en el mes: no hay nada que exportar.')).toBeInTheDocument()
    expect(within(sobrante).getByRole('button', { name: /Exportar a WinConta/ })).toBeDisabled()
  })

  it('mes abierto: muestra el motivo de la API (vista previa) y no deja exportar', async () => {
    api.en('GET', '/asientos', asientosMesDemo({
      estadoMes: 'ABIERTO',
      asientos: [asientoDemo({ exportable: false, motivoNoExportable: 'PERIODO_NO_CERRADO' })],
    }))
    abrir(['inventario:CONTADOR'], '?anio=2026&mes=3')
    const costo = await seccion('Costo de ventas')
    expect(within(costo).getByText(/no está cerrado: esto es una vista previa/)).toBeInTheDocument()
    expect(within(costo).getByRole('button', { name: /Exportar a WinConta/ })).toBeDisabled()
    expect(screen.getByText('Abierto')).toBeInTheDocument()
  })

  it('CONSULTA y ASISTENTE no ven «Exportar a WinConta»; ADMIN sí', async () => {
    for (const rol of ['inventario:CONSULTA', 'inventario:ASISTENTE']) {
      const { unmount } = abrir([rol])
      await seccion('Costo de ventas')
      expect(screen.queryByRole('button', { name: /Exportar a WinConta/ })).not.toBeInTheDocument()
      unmount()
    }
    abrir(['inventario:ADMIN'])
    expect(within(await seccion('Costo de ventas')).getByRole('button', { name: /Exportar a WinConta/ })).toBeInTheDocument()
  })

  it('valida con zod en español antes de enviar y descarga con {anio, mes, tipoAsiento, numeroAsiento, tipoCambio} como texto', async () => {
    abrir()
    await userEvent.click(within(await seccion('Costo de ventas')).getByRole('button', { name: /Exportar a WinConta/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Exportar a WinConta · Costo de ventas · Enero 2026' })
    await userEvent.type(within(dialogo).getByLabelText('N.° de asiento'), '12')
    await userEvent.type(within(dialogo).getByLabelText('Tipo de cambio'), '0')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Exportar y descargar/ }))
    expect(await within(dialogo).findByText('El número de asiento debe tener exactamente 4 dígitos (por ejemplo, 0001).')).toBeInTheDocument()
    expect(within(dialogo).getByText('El tipo de cambio debe ser mayor que 0.')).toBeInTheDocument()
    expect(descargarArchivoPost).not.toHaveBeenCalled()

    await userEvent.clear(within(dialogo).getByLabelText('N.° de asiento'))
    await userEvent.type(within(dialogo).getByLabelText('N.° de asiento'), '0001')
    await userEvent.clear(within(dialogo).getByLabelText('Tipo de cambio'))
    await userEvent.type(within(dialogo).getByLabelText('Tipo de cambio'), '3.750')
    const consultasAntes = api.hechas('GET', '/asientos/exportados').length
    await userEvent.click(within(dialogo).getByRole('button', { name: /Exportar y descargar/ }))
    await waitFor(() => expect(descargarArchivoPost).toHaveBeenCalledWith('/asientos/winconta', {
      anio: 2026, mes: 1, tipoAsiento: 'COSTO_VENTAS', numeroAsiento: '0001', tipoCambio: '3.750',
    }, 'winconta_costo-ventas_2026-01.xlsx'))
    expect(toast.success).toHaveBeenCalledWith('Asiento de costo de ventas de Enero 2026 exportado · descarga lista: winconta_costo-ventas_2026-01.xlsx')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Se recarga el historial (y los asientos) para mostrar la exportación nueva.
    await waitFor(() => expect(api.hechas('GET', '/asientos/exportados').length).toBeGreaterThan(consultasAntes))
  })

  it.each([
    [new ErrorApi(409, 'PERIODO_NO_CERRADO', 'x'), 'Ese mes aún no está cerrado: el asiento se exporta a WinConta después de cerrarlo en Periodos.'],
    [new ErrorApi(422, 'REGLA_CONTABLE_FALTANTE', 'x'), 'Hay movimientos de este tipo sin regla contable vigente: configúrala en Maestros → Reglas contables y vuelve a exportar.'],
    [new ErrorApi(422, 'ASIENTO_VACIO', 'x'), 'Este asiento no tiene líneas en el mes: no hay nada que exportar.'],
    [new ErrorApi(429, 'DEMASIADAS_SOLICITUDES', 'x'), 'Llegaste al límite de descargas por minuto. Espera un momento y vuelve a intentarlo.'],
  ])('error al exportar (%s): mensaje claro dentro del diálogo', async (error, mensaje) => {
    vi.mocked(descargarArchivoPost).mockRejectedValueOnce(error)
    abrir()
    await userEvent.click(within(await seccion('Costo de ventas')).getByRole('button', { name: /Exportar a WinConta/ }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('N.° de asiento'), '0001')
    await userEvent.type(within(dialogo).getByLabelText('Tipo de cambio'), '3.750')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Exportar y descargar/ }))
    expect(await within(dialogo).findByText(mensaje)).toBeInTheDocument()
  })

  it('400 VALIDACION de la API: el mensaje queda junto al campo marcado', async () => {
    vi.mocked(descargarArchivoPost).mockRejectedValueOnce(new ErrorApi(400, 'VALIDACION', 'x', {
      campos: { numeroAsiento: 'El número de asiento ya se usó en otro mes.' },
    }))
    abrir()
    await userEvent.click(within(await seccion('Costo de ventas')).getByRole('button', { name: /Exportar a WinConta/ }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('N.° de asiento'), '0001')
    await userEvent.type(within(dialogo).getByLabelText('Tipo de cambio'), '3.750')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Exportar y descargar/ }))
    const campo = within(dialogo).getByLabelText('N.° de asiento')
    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'))
    expect(within(dialogo).getByText('El número de asiento ya se usó en otro mes.')).toBeInTheDocument()
  })

  it('historial del año: vigente, desactualizado y reemplazada, siempre con texto', async () => {
    api.en('GET', '/asientos/exportados', exportadosDemo([
      exportadoDemo(),
      exportadoDemo({ id: 2, tipoAsiento: 'MERMA', vigente: true, desactualizado: true }),
      exportadoDemo({ id: 3, numeroAsiento: '0002', vigente: false }),
    ]))
    abrir(['inventario:CONSULTA'])
    const historial = await screen.findByRole('region', { name: 'Historial de exportaciones de 2026' })
    expect(await within(historial).findByText('Vigente')).toBeInTheDocument()
    expect(within(historial).getByText('Desactualizado: vuelve a exportar')).toBeInTheDocument()
    expect(within(historial).getByText('Reemplazada')).toBeInTheDocument()
    expect(within(historial).getAllByText('3.750')).toHaveLength(3)
  })

  it('historial: la columna Mes se ordena por fecha (no alfabéticamente)', async () => {
    api.en('GET', '/asientos/exportados', exportadosDemo([
      exportadoDemo({ id: 1, mes: 4, periodo: '2026-04' }),
      exportadoDemo({ id: 2, mes: 1, periodo: '2026-01', numeroAsiento: '0002' }),
    ]))
    abrir(['inventario:CONSULTA'])
    const historial = await screen.findByRole('region', { name: 'Historial de exportaciones de 2026' })
    await within(historial).findByText('Abril 2026')
    await userEvent.click(within(historial).getByRole('button', { name: /Mes/ }))
    const filas = within(historial).getAllByRole('row').slice(1)
    expect(filas[0]).toHaveTextContent('Enero 2026')
    expect(filas[1]).toHaveTextContent('Abril 2026')
  })

  it('error al cargar: mensaje y Reintentar', async () => {
    api.en('GET', '/asientos', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir()
    expect(await screen.findByText(/Ocurrió un error inesperado/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0)
  })
})
