import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaCierreAnual } from './pagina-cierre-anual'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { productosDemo } from '@/pruebas/comprobantes-demo'
import { vistaCierreDemo } from '@/pruebas/periodos-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-02-10' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/productos', productosDemo)
  api.en('GET', '/periodos/2025/cierre-anual/vista-previa', vistaCierreDemo())
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = () => renderizarEnRuta(<PaginaCierreAnual />, {
  ruta: '/inventario/periodos/cierre-anual', patron: '/inventario/periodos/cierre-anual', roles: ['inventario:CONTADOR'],
})

const paso = (n: number) => screen.findByRole('heading', { name: new RegExp(`^Paso ${n} de 3`) })

describe('Cierre anual', () => {
  it('paso 1: con meses abiertos avisa cuáles y no deja avanzar', async () => {
    api.en('GET', '/periodos/2025/cierre-anual/vista-previa', vistaCierreDemo({ mesesAbiertos: ['2025-11', '2025-12'] }))
    abrir()
    expect(await screen.findByText('Cierra los 12 meses antes del cierre anual.')).toBeInTheDocument()
    expect(screen.getByText(/Meses abiertos: Noviembre 2025, Diciembre 2025/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled()
  })

  it('paso 2: propuesto frente al existente, diferencias con signo y resaltadas; paso 3: exige elegir y envía confirmarReemplazo', async () => {
    api.en('POST', '/periodos/2025/cierre-anual', {
      ...vistaCierreDemo(), kardexRecalculados: 1,
    })
    abrir()
    expect(await screen.findByText('Los 12 meses de 2025 están cerrados.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await paso(2)
    const fierro = screen.getByRole('rowheader', { name: 'FIERRO · Chatarra de fierro' }).closest('tr') as HTMLElement
    expect(within(fierro).getByText('+0.01')).toBeInTheDocument()
    expect(within(fierro).getByText('0.0000')).toBeInTheDocument()
    expect(within(fierro).getByText('Diferente')).toBeInTheDocument()
    expect(within(fierro).getByText('Manual')).toBeInTheDocument()
    expect(within(fierro).getByText('Saldo inicial desactualizado')).toBeInTheDocument()
    const inox = screen.getByRole('rowheader', { name: 'INOXIDABLE · Chatarra inoxidable' }).closest('tr') as HTMLElement
    expect(within(inox).getByText('Nuevo')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await paso(3)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el cierre anual de 2025' }))
    expect(await screen.findByText('Elige qué hacer con los saldos iniciales existentes que son distintos.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Reemplazar el saldo inicial existente/)).toHaveFocus()
    expect(api.hechas('POST', '/periodos/2025/cierre-anual')).toHaveLength(0)

    await userEvent.click(screen.getByLabelText(/Reemplazar el saldo inicial existente/))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el cierre anual de 2025' }))
    await waitFor(() => expect(api.hechas('POST', '/periodos/2025/cierre-anual')[0]?.cuerpo).toEqual({ confirmarReemplazo: true }))
    expect(toast.success).toHaveBeenCalledWith('Cierre anual de 2025 registrado · saldo inicial de 2026 actualizado')
    expect(await screen.findByRole('link', { name: 'Ver saldos iniciales de 2026' })).toHaveAttribute('href', '/inventario/saldos-iniciales?anio=2026')
  })

  it('"Conservar los existentes" envía conservarExistentes', async () => {
    api.en('POST', '/periodos/2025/cierre-anual', { ...vistaCierreDemo(), kardexRecalculados: 0 })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await userEvent.click(await screen.findByLabelText(/Conservar los existentes/))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el cierre anual de 2025' }))
    await waitFor(() => expect(api.hechas('POST', '/periodos/2025/cierre-anual')[0]?.cuerpo).toEqual({ conservarExistentes: true }))
  })

  it('SALDO_INICIAL_REQUIERE_CONFIRMACION vuelve al paso 2 con el mensaje', async () => {
    api.en('GET', '/periodos/2025/cierre-anual/vista-previa', vistaCierreDemo({ requiereConfirmacion: false, saldos: [vistaCierreDemo().saldos[1]] }))
    api.en('POST', '/periodos/2025/cierre-anual', () => { throw new ErrorApi(409, 'SALDO_INICIAL_REQUIERE_CONFIRMACION', 'x') })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await paso(3)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el cierre anual de 2025' }))
    expect(await paso(2)).toHaveFocus()
    expect(screen.getByText('El saldo inicial de 2026 ya existe y es distinto. Elige si lo reemplazas o lo conservas.')).toBeInTheDocument()
    await waitFor(() => expect(api.hechas('GET', '/periodos/2025/cierre-anual/vista-previa').length).toBeGreaterThan(1))
  })

  it('STOCK_NEGATIVO_REQUIERE_CONFIRMACION: diálogo y reenvío con confirmarStockNegativo', async () => {
    let intentos = 0
    api.en('POST', '/periodos/2025/cierre-anual', (l: { cuerpo: { confirmarStockNegativo?: boolean } }) => {
      intentos += 1
      if (!l.cuerpo.confirmarStockNegativo) {
        throw new ErrorApi(409, 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION', 'x',
          { productoId: 1, fecha: '2026-01-15', saldoResultante: '-2.0000', disponibleAntes: '3.0000' })
      }
      return { ...vistaCierreDemo(), kardexRecalculados: 1 }
    })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await userEvent.click(await screen.findByLabelText(/Reemplazar el saldo inicial existente/))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar el cierre anual de 2025' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'El stock quedará en negativo' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar de todos modos' }))
    await waitFor(() => expect(intentos).toBe(2))
    expect(api.hechas('POST', '/periodos/2025/cierre-anual').map((l) => l.cuerpo)).toEqual([
      { confirmarReemplazo: true },
      { confirmarReemplazo: true, confirmarStockNegativo: true },
    ])
  })
})
