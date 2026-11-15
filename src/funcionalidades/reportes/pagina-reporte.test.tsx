import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaExcelContadora } from './pagina-excel-contadora'
import { PaginaReporte } from './pagina-reporte'
import { solicitar } from '@/api/cliente'
import { descargarArchivo } from '@/api/descargas'
import { PAGINAS_DEL_MODULO } from '@/app/paginas'
import { ErrorApi } from '@/lib/errores'
import { puede } from '@/lib/roles'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { costoVentasDemo, margenDemo, resumenAnualDemo, toneladasDemo } from '@/pruebas/libros-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('@/api/descargas', () => ({ descargarArchivo: vi.fn(async (_ruta: string, nombre: string) => nombre) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// recharts necesita medir el tamaño (no hay layout en jsdom): el gráfico se reemplaza por su figura.
vi.mock('./grafico-margen', () => ({
  GraficoMargen: ({ anio }: { anio: number }) => <figure aria-label={`Gráfico de margen ${anio}`} />,
}))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/reportes/toneladas', toneladasDemo())
  api.en('GET', '/reportes/costo-ventas', costoVentasDemo())
  api.en('GET', '/reportes/resumen-anual', resumenAnualDemo())
  api.en('GET', '/reportes/margen', margenDemo())
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (tipo: Parameters<typeof PaginaReporte>[0]['tipo'], roles = ['inventario:CONSULTA']) =>
  renderizarEnRuta(<PaginaReporte tipo={tipo} />, { ruta: `/inventario/reportes/${tipo}?anio=2026`, patron: `/inventario/reportes/${tipo}`, roles })

const filaTotal = (tabla: HTMLElement, texto = 'TOTAL') => within(tabla).getByRole('rowheader', { name: texto }).closest('tr') as HTMLElement

describe('Reportes', () => {
  it('Toneladas: bloque por producto y "EN TONELADAS", con 4 decimales y la fila TOTAL de la API', async () => {
    abrir('toneladas')
    const fierro = await screen.findByRole('table', { name: /FIERRO · CHATARRA DE FIERRO \(TN\)/ })
    expect(api.hechas('GET', '/reportes/toneladas')[0].ruta).toBe('/reportes/toneladas?anio=2026')
    expect(within(fierro).getByRole('columnheader', { name: 'SALDO INICIAL' })).toBeInTheDocument()
    expect(within(fierro).getByRole('rowheader', { name: 'Enero' })).toBeInTheDocument()
    expect(within(filaTotal(fierro)).getByText('40.0000')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /^EN TONELADAS/ })).toBeInTheDocument()
  })

  it('Costo de ventas: COSTO DE VENTAS, MERMAS y TOTAL SALIDAS VALORIZADAS con los totales de la API', async () => {
    abrir('costo-ventas')
    const fierro = await screen.findByRole('table', { name: /FIERRO · CHATARRA DE FIERRO/ })
    for (const nombre of ['COSTO DE VENTAS', 'MERMAS', 'TOTAL SALIDAS VALORIZADAS']) {
      expect(within(fierro).getByRole('columnheader', { name: nombre })).toBeInTheDocument()
    }
    const total = filaTotal(fierro)
    expect(within(total).getByText('31,320.00')).toBeInTheDocument()
    expect(within(total).getByText('32,400.00')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /^RESUMEN/ })).toBeInTheDocument()
  })

  it('Resumen anual: conceptos por producto (TN y S/) y la columna TOTAL', async () => {
    abrir('resumen-anual')
    const tabla = await screen.findByRole('table', { name: /Resumen anual 2026/ })
    expect(within(tabla).getByRole('columnheader', { name: 'FIERRO' })).toBeInTheDocument()
    expect(within(tabla).getByRole('columnheader', { name: 'TOTAL' })).toBeInTheDocument()
    const tsv = within(tabla).getByRole('rowheader', { name: 'TOTAL SALIDAS VALORIZADAS' }).closest('tr') as HTMLElement
    expect(within(tsv).getAllByText('32,400.00')).toHaveLength(2)
    const cv = within(tabla).getByRole('rowheader', { name: 'COSTO DE VENTAS' }).closest('tr') as HTMLElement
    expect(within(cv).getAllByText('29.0000')).toHaveLength(2)
  })

  it('Margen: ventas, costo, margen y %, ventas sin precio aparte, "—" sin porcentaje y gráfico de barras', async () => {
    abrir('margen')
    const fierro = await screen.findByRole('table', { name: /FIERRO · CHATARRA DE FIERRO/ })
    expect(await screen.findByRole('figure', { name: 'Gráfico de margen 2026' })).toBeInTheDocument()
    for (const nombre of ['VENTAS S/', 'COSTO DE VENTAS S/', 'MARGEN S/', 'MARGEN %', 'VENTAS SIN PRECIO TN']) {
      expect(within(fierro).getByRole('columnheader', { name: nombre })).toBeInTheDocument()
    }
    const enero = within(fierro).getByRole('rowheader', { name: 'Enero' }).closest('tr') as HTMLElement
    expect(enero).toHaveTextContent('10.00 %')
    expect(within(enero).getByText('2.0000')).toBeInTheDocument()
    const febrero = within(fierro).getByRole('rowheader', { name: 'Febrero' }).closest('tr') as HTMLElement
    expect(within(febrero).getByText('—')).toBeInTheDocument()
    expect(within(febrero).getByText('sin ventas con precio')).toBeInTheDocument()
    const total = filaTotal(screen.getByRole('table', { name: /^TOTAL DE PRODUCTOS/ }))
    expect(within(total).getByText('3,600.00')).toBeInTheDocument()
  })

  it('Descargar Excel del reporte del año elegido', async () => {
    abrir('toneladas')
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar Excel de Toneladas 2026' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith('/reportes/toneladas?anio=2026&formato=xlsx', 'toneladas-2026.xlsx'))
  })

  it('error de carga: Reintentar; sin productos: mensaje vacío', async () => {
    api.en('GET', '/reportes/margen', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    const { unmount } = abrir('margen')
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    unmount()
    api.en('GET', '/reportes/toneladas', { ...toneladasDemo(), productos: [] })
    abrir('toneladas')
    expect(await screen.findByText('No hay datos de 2026 para este reporte.')).toBeInTheDocument()
  })
})

describe('Excel formato contadora', () => {
  it('solo ADMIN y CONTADOR (ruta, menú y permiso)', () => {
    const pagina = PAGINAS_DEL_MODULO.find((p) => p.ruta === '/inventario/reportes/excel-contadora')
    expect(pagina?.roles).toEqual(['ADMIN', 'CONTADOR'])
    expect(puede('reportes:excel-contadora', ['inventario:ADMIN'])).toBe(true)
    expect(puede('reportes:excel-contadora', ['inventario:CONTADOR'])).toBe(true)
    expect(puede('reportes:excel-contadora', ['inventario:ASISTENTE'])).toBe(false)
    expect(puede('reportes:excel-contadora', ['inventario:CONSULTA'])).toBe(false)
  })

  it('selector de año y descarga del .xlsx del año', async () => {
    renderizarEnRuta(<PaginaExcelContadora />, {
      ruta: '/inventario/reportes/excel-contadora?anio=2025', patron: '/inventario/reportes/excel-contadora', roles: ['inventario:CONTADOR'],
    })
    expect(screen.getByLabelText('Año')).toHaveValue('2025')
    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel formato contadora de 2025' }))
    await waitFor(() => expect(descargarArchivo).toHaveBeenCalledWith('/reportes/excel-contadora?anio=2025', 'excel-contadora-2025.xlsx'))
  })
})
