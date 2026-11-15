import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaSaldosIniciales } from './pagina-saldos-iniciales'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { productosDemo } from '@/pruebas/comprobantes-demo'
import { saldoInicialDemo } from '@/pruebas/periodos-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-03-25' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
  api.en('GET', '/saldos-iniciales', [
    saldoInicialDemo(),
    saldoInicialDemo({ id: 5, productoId: 2, productoCodigo: 'INOXIDABLE', cantidad: '1234.5', costoTotal: '98765.432',
      origen: 'MANUAL', motivo: 'Ajuste demo', desactualizado: true }),
  ])
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[]) =>
  renderizarEnRuta(<PaginaSaldosIniciales />, { ruta: '/inventario/saldos-iniciales?anio=2026', patron: '/inventario/saldos-iniciales', roles })

const fila = (texto: string) => screen.getByText(texto).closest('tr') as HTMLElement

describe('Saldos iniciales', () => {
  it('tabla por producto con cantidad (4 decimales), total (2), origen y ⚠ Desactualizado; sin columna C.U.', async () => {
    abrir(['inventario:CONSULTA'])
    await screen.findByText('FIERRO · Chatarra de fierro')
    expect(api.hechas('GET', '/saldos-iniciales')[0].ruta).toBe('/saldos-iniciales?anio=2026')
    expect(screen.queryByRole('columnheader', { name: /C\.U\.|Costo unitario/ })).not.toBeInTheDocument()
    const inox = fila('INOXIDABLE · Chatarra inoxidable')
    expect(within(inox).getByText('1,234.5000')).toBeInTheDocument()
    expect(within(inox).getByText('98,765.43')).toBeInTheDocument()
    expect(within(inox).getByText('Manual')).toBeInTheDocument()
    expect(within(inox).getByText('Saldo inicial desactualizado')).toBeInTheDocument()
    expect(within(fila('FIERRO · Chatarra de fierro')).getByText('Cierre anual')).toBeInTheDocument()
    // CONSULTA no edita ni ve el enlace al cierre anual (solo A y C).
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /cierre anual/ })).not.toBeInTheDocument()
  })

  it('CONTADOR edita un saldo manual: motivo obligatorio, decimales como texto', async () => {
    api.en('PUT', '/saldos-iniciales/4', saldoInicialDemo({ origen: 'MANUAL', cantidad: '50.5000' }))
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar el saldo inicial 2026 de FIERRO' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Saldo inicial 2026 · FIERRO' })
    const cantidad = within(dialogo).getByLabelText('Cantidad TN')
    expect(cantidad).toHaveValue('50')
    await userEvent.clear(cantidad)
    await userEvent.type(cantidad, '50,5')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Guardar/ }))
    expect(await within(dialogo).findByText('Escribe el motivo del cambio.')).toBeInTheDocument()
    expect(api.hechas('PUT', '/saldos-iniciales/4')).toHaveLength(0)

    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Cuadre con el sistema contable')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Guardar/ }))
    await waitFor(() => expect(api.hechas('PUT', '/saldos-iniciales/4')[0]?.cuerpo).toEqual({
      cantidad: '50.5', costoTotal: '3000', motivo: 'Cuadre con el sistema contable',
    }))
    expect(toast.success).toHaveBeenCalledWith('Saldo inicial 2026 de FIERRO actualizado · kardex recalculado')
  })

  it('stock negativo al editar: diálogo y reenvío con confirmarStockNegativo', async () => {
    api.en('PUT', '/saldos-iniciales/4', (l: { cuerpo: { confirmarStockNegativo?: boolean } }) => {
      if (!l.cuerpo.confirmarStockNegativo) {
        throw new ErrorApi(409, 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION', 'x',
          { productoId: 1, fecha: '2026-03-20', saldoResultante: '-5.0000', disponibleAntes: '40.0000' })
      }
      return saldoInicialDemo()
    })
    abrir(['inventario:ADMIN'])
    await userEvent.click(await screen.findByRole('button', { name: 'Editar el saldo inicial 2026 de FIERRO' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Motivo demo')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Guardar/ }))
    const stock = await screen.findByRole('alertdialog', { name: 'El stock quedará en negativo' })
    await userEvent.click(within(stock).getByRole('button', { name: 'Registrar de todos modos' }))
    await waitFor(() => expect(api.hechas('PUT', '/saldos-iniciales/4')).toHaveLength(2))
    expect(api.hechas('PUT', '/saldos-iniciales/4')[1].cuerpo).toMatchObject({ confirmarStockNegativo: true })
  })

  it('sin saldos: mensaje vacío; error de carga: Reintentar', async () => {
    api.en('GET', '/saldos-iniciales', [])
    const { unmount } = abrir(['inventario:CONTADOR'])
    expect(await screen.findByText(/No hay saldos iniciales de 2026/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al cierre anual 2025' })).toHaveAttribute('href', '/inventario/periodos/cierre-anual?anio=2025')
    unmount()
    api.en('GET', '/saldos-iniciales', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir(['inventario:CONTADOR'])
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
