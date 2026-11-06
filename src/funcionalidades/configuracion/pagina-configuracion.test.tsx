import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaConfiguracion } from './pagina-configuracion'
import { solicitar } from '@/api/cliente'
import type { Configuracion } from '@/api/configuracion'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { catalogosDemo, crearApiFalsa, renderizarConSesion } from '@/pruebas/api-falsa'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Empresa de demostración (docs/UI-UX.md §10) y valores de ejemplo del OpenAPI.
const configuracion: Configuracion = {
  empresa: { ruc: '20000000001', razonSocial: 'EMPRESA DEMO S.A.C.' },
  inventario: { politicaStockNegativo: 'PERMITIR_CON_ALERTA', decimalesRedondeoSiCosto: 2 },
  libro: {
    modoPorDefecto: 'AGRUPADO', unidadMedida: 'TNE', decimalesCantidad: 3, decimalesSaldo: 2, decimalesTotales: 2,
    impresion: {
      imprimirFolio: false, papel: 'A4', orientacion: 'HORIZONTAL',
      margenesMm: { superior: 30, inferior: 12, izquierdo: 15, derecho: 12 }, reservaSelloMm: { ancho: 70, alto: 30 },
      recordarImpresionMesesDespues: 1, plazoLegalAtrasoMeses: 3,
    },
  },
  asientos: { mermaEnAsientoSeparado: true },
  winconta: {
    subdiario: '04', tipoCp: 'T', codigoCp: '00000000001', razonSocial: 'PROVISIONES', tipoDocumento: '00', serie: '',
    plantillaNumeroComprobante: 'CV{MM}{AAAA}', plantillaGlosa: 'PROVISION COSTO DE VENTAS {MES} {AAAA}',
    plantillaNumeroComprobanteMerma: 'IT{AAAA}', plantillaGlosaMerma: 'MERMA SEGUN INFORME TECNICO {AAAA}',
    plantillaNumeroComprobanteDesmedro: 'DM{MM}{AAAA}', plantillaGlosaDesmedro: 'DESMEDRO SEGUN ACTA {MES} {AAAA}',
    plantillaNumeroComprobanteAjuste: 'AJ{MM}{AAAA}', plantillaGlosaAjuste: 'AJUSTE POR DIFERENCIA DE INVENTARIO {MES} {AAAA}',
    moneda: 'S', columnas: 19,
  },
  tomaInventario: { obligatoria: false, recordarDesdeMes: 11, toleranciaDiferenciaTn: '0.01' },
  actualizadoEn: '2026-10-20T14:30:00.000Z',
}

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/catalogos', catalogosDemo)
  api.en('GET', '/configuracion', configuracion)
  api.en('PATCH', '/configuracion', configuracion)
  api.en('GET', `/configuracion/libro-modo/${new Date().getFullYear()}`, { anio: new Date().getFullYear(), modo: 'AGRUPADO', origen: 'POR_DEFECTO' })
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const pestana = (nombre: RegExp) => screen.findByRole('tab', { name: nombre })

describe('Configuración', () => {
  it('CONTADOR: Empresa y Toma de inventario en solo lectura, sin Guardar', async () => {
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:CONTADOR'])
    // Abre en Libro 12.1 (lo que sí puede editar)
    expect(await pestana(/Libro 12\.1/)).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(await pestana(/Empresa/))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Solo lectura: esta sección la edita el administrador.')).toBeInTheDocument()
    expect(within(panel).getByLabelText('Política de stock negativo')).toBeDisabled()
    expect(within(panel).queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    expect(within(panel).getByText('20000000001')).toHaveClass('font-mono')

    await userEvent.click(await pestana(/Toma de inventario/))
    expect(within(screen.getByRole('tabpanel')).getByLabelText('Tolerancia de diferencia (TN)')).toBeDisabled()
    expect(within(screen.getByRole('tabpanel')).queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })

  it('CONTADOR guarda Libro 12.1 enviando solo la sección libro, con enteros', async () => {
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:CONTADOR'])
    await pestana(/Libro 12\.1/)
    const panel = screen.getByRole('tabpanel')
    const margen = within(panel).getByLabelText('Margen superior (mm)')
    await userEvent.clear(margen)
    await userEvent.type(margen, '25')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('PATCH', '/configuracion')).toHaveLength(1))
    const cuerpo = api.hechas('PATCH', '/configuracion')[0].cuerpo as Record<string, unknown>
    expect(Object.keys(cuerpo)).toEqual(['libro'])
    expect(cuerpo).toMatchObject({ libro: { impresion: { margenesMm: { superior: 25, inferior: 12 } }, decimalesCantidad: 3 } })
  })

  it('valida los rangos en español', async () => {
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:CONTADOR'])
    await pestana(/Libro 12\.1/)
    const panel = screen.getByRole('tabpanel')
    const decimales = within(panel).getByLabelText('Entradas y salidas')
    await userEvent.clear(decimales)
    await userEvent.type(decimales, '7')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    expect(await within(panel).findByText('Decimales de entradas y salidas: de 0 a 4.')).toBeInTheDocument()
    expect(api.hechas('PATCH', '/configuracion')).toHaveLength(0)
  })

  it('CONTADOR guarda WinConta; las 19 columnas son fijas', async () => {
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:CONTADOR'])
    await userEvent.click(await pestana(/WinConta/))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText(/formato de 19 columnas \(fijo\)/)).toBeInTheDocument()
    const subdiario = within(panel).getByLabelText('Subdiario')
    await userEvent.clear(subdiario)
    await userEvent.type(subdiario, '05')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('PATCH', '/configuracion')).toHaveLength(1))
    const cuerpo = api.hechas('PATCH', '/configuracion')[0].cuerpo as { winconta: Record<string, unknown> }
    expect(Object.keys(cuerpo)).toEqual(['winconta'])
    expect(cuerpo.winconta.subdiario).toBe('05')
    expect(cuerpo.winconta).not.toHaveProperty('columnas')
  })

  it('ADMIN edita Empresa y Toma; la tolerancia viaja como string decimal', async () => {
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:ADMIN'])
    expect(await pestana(/Empresa/)).toHaveAttribute('aria-selected', 'true')
    await userEvent.selectOptions(within(screen.getByRole('tabpanel')).getByLabelText('Política de stock negativo'), 'BLOQUEAR')
    await userEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('PATCH', '/configuracion')[0]?.cuerpo).toEqual({
      inventario: { politicaStockNegativo: 'BLOQUEAR', decimalesRedondeoSiCosto: 2 },
      asientos: { mermaEnAsientoSeparado: true },
    }))

    await userEvent.click(await pestana(/Toma de inventario/))
    const tolerancia = within(screen.getByRole('tabpanel')).getByLabelText('Tolerancia de diferencia (TN)')
    await userEvent.clear(tolerancia)
    await userEvent.type(tolerancia, '0,05')
    await userEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.hechas('PATCH', '/configuracion')).toHaveLength(2))
    expect(api.hechas('PATCH', '/configuracion')[1].cuerpo).toEqual({
      tomaInventario: { obligatoria: false, recordarDesdeMes: 11, toleranciaDiferenciaTn: '0.05' },
    })
  })

  it('fija el modo del libro de un año con PUT', async () => {
    const anio = new Date().getFullYear()
    api.en('PUT', `/configuracion/libro-modo/${anio}`, { anio, modo: 'DETALLADO', origen: 'ANIO' })
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:CONTADOR'])
    await pestana(/Libro 12\.1/)
    const seccion = screen.getByRole('region', { name: 'Modo del libro por año' })
    expect(await within(seccion).findByText('Sin fijar: usa el modo por defecto.')).toBeInTheDocument()
    await userEvent.selectOptions(within(seccion).getByLabelText('Modo'), 'DETALLADO')
    await userEvent.click(within(seccion).getByRole('button', { name: `Fijar modo de ${anio}` }))
    await waitFor(() => expect(api.hechas('PUT', `/configuracion/libro-modo/${anio}`)[0]?.cuerpo).toEqual({ modo: 'DETALLADO' }))
    expect(await within(seccion).findByText(`Fijado para ${anio}.`)).toBeInTheDocument()
  })

  it('cambiar de pestaña no borra lo que aún no se guardó', async () => {
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:CONTADOR'])
    await pestana(/Libro 12\.1/)
    const margen = within(screen.getByRole('tabpanel')).getByLabelText('Margen superior (mm)')
    await userEvent.clear(margen)
    await userEvent.type(margen, '25')
    await userEvent.click(await pestana(/WinConta/))
    await userEvent.click(await pestana(/Libro 12\.1/))
    expect(within(screen.getByRole('tabpanel')).getByLabelText('Margen superior (mm)')).toHaveValue('25')
  })

  it('muestra el error de la API al guardar', async () => {
    api.en('PATCH', '/configuracion', () => { throw new ErrorApi(403, 'SIN_PERMISO', 'x') })
    renderizarConSesion(<PaginaConfiguracion />, ['inventario:CONTADOR'])
    await pestana(/Libro 12\.1/)
    await userEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('No tienes permiso para esta acción.')).toBeInTheDocument()
  })
})
