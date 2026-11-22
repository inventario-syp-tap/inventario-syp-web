import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaDetalleToma } from './pagina-detalle-toma'
import { solicitar } from '@/api/cliente'
import type { Toma } from '@/api/tomas-inventario'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta, type Llamada } from '@/pruebas/api-falsa'
import { lineaTomaDemo, tomaDemo } from '@/pruebas/contabilidad-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const api = crearApiFalsa()

const resuelta: Toma = tomaDemo({
  resuelta: true,
  lineas: [
    lineaTomaDemo({ accion: 'MERMA', comprobante: { id: 'comp-8', naturaleza: 'MERMA', documento: '00-IT-2026' } }),
    lineaTomaDemo({
      productoId: 2, productoCodigo: 'INOXIDABLE', productoDescripcion: 'CHATARRA INOXIDABLE DEMO', cantidadSistema: '10.0000',
      cantidadContada: '10.5000', diferencia: '0.5000', tipoDiferencia: 'SOBRANTE', accion: 'AJUSTE',
      comprobante: { id: 'comp-9', naturaleza: 'AJUSTE', documento: '00-AI-0001' },
    }),
  ],
  comprobantes: [
    { id: 'comp-8', naturaleza: 'MERMA', documento: '00-IT-2026' },
    { id: 'comp-9', naturaleza: 'AJUSTE', documento: '00-AI-0001' },
  ],
})

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/tomas-inventario/toma-1', tomaDemo())
  api.en('GET', '/tomas-inventario', [tomaDemo()])
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[] = ['inventario:CONTADOR'], id = 'toma-1') => renderizarEnRuta(<PaginaDetalleToma />, {
  ruta: `/inventario/toma-inventario/${id}`, patron: '/inventario/toma-inventario/:id', roles,
})

const grupo = (codigo: string) => screen.getByRole('group', { name: new RegExp(`^${codigo} ·`) })

/** Elige las acciones del paso 4: FIERRO (faltante) y INOXIDABLE (sobrante). */
async function elegir(fierro: string, inox: string) {
  await userEvent.click(within(grupo('FIERRO')).getByRole('radio', { name: fierro }))
  await userEvent.click(within(grupo('INOXIDABLE')).getByRole('radio', { name: inox }))
}

describe('Toma de inventario — detalle (pasos 3 y 4)', () => {
  it('paso 3: sistema a la fecha, contado, diferencia y tipo (con ícono y texto) tal como los calcula la API', async () => {
    abrir(['inventario:CONSULTA'])
    expect(await screen.findByRole('heading', { name: 'Toma del 31/03/2026' })).toBeInTheDocument()
    const tabla = screen.getByRole('table', { name: /Diferencias de la toma del 31\/03\/2026/ })
    const fierro = within(tabla).getByRole('rowheader', { name: /FIERRO/ }).closest('tr') as HTMLElement
    expect(within(fierro).getByText('15.0000')).toBeInTheDocument()
    expect(within(fierro).getByText('14.7500')).toBeInTheDocument()
    expect(within(fierro).getByText('-0.2500')).toBeInTheDocument()
    expect(within(fierro).getByText('(negativo)')).toBeInTheDocument()
    expect(within(fierro).getByText('Faltante')).toBeInTheDocument()
    expect(within(fierro).getByText('Pendiente')).toBeInTheDocument()
    expect(within(tabla).getByText('Sobrante')).toBeInTheDocument()
    expect(within(tabla).getByText('Sin diferencia')).toBeInTheDocument()
  })

  it('CONSULTA y ASISTENTE no ven el paso 4 (ni resolver ni cerrar)', async () => {
    for (const rol of ['inventario:CONSULTA', 'inventario:ASISTENTE']) {
      const { unmount } = abrir([rol])
      await screen.findByRole('heading', { name: 'Toma del 31/03/2026' })
      expect(screen.queryByRole('button', { name: 'Resolver diferencias' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cerrar toma' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('validaciones del paso 4: acción obligatoria, merma solo para faltantes, observación con Ninguna y sustentos', async () => {
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Resolver diferencias' }))
    expect(await screen.findAllByText('Elige una acción para este producto.')).toHaveLength(2)
    // INOXIDABLE es sobrante: la merma no se ofrece (y el foco del error cae en un radio habilitado).
    expect(within(grupo('INOXIDABLE')).queryByRole('radio', { name: /Merma \(13\)/ })).not.toBeInTheDocument()
    expect(within(grupo('INOXIDABLE')).getByText('La merma (13) solo corresponde a faltantes.')).toBeInTheDocument()
    expect(within(grupo('FIERRO')).getByRole('radio', { name: /Merma \(13\)/ })).toBeEnabled()
    expect(within(grupo('FIERRO')).getByRole('radio', { name: /Merma \(13\)/ })).toHaveFocus()
    // Sin doble negativo: "Faltante de 0.2500 TN".
    expect(grupo('FIERRO')).toHaveTextContent('Faltante de 0.2500 TN')

    await elegir('Merma (13)', 'Ninguna')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    expect(await screen.findByText('Indica por qué no se registra ninguna acción.')).toBeInTheDocument()
    expect(screen.getByText('Indica el sustento de la merma (informe técnico).')).toBeInTheDocument()
    expect(screen.getByLabelText('Año del informe')).toHaveValue('2026')
    expect(api.hechas('POST', '/tomas-inventario/toma-1/resolver')).toHaveLength(0)

    await elegir('Ajuste (28)', 'Ajuste (28)')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    expect(await screen.findByText('Indica el sustento del ajuste (acta de la toma de inventario).')).toBeInTheDocument()
  })

  it('resuelve: envía una acción por producto con diferencia y los sustentos; el foco pasa al paso 4 (Cerrar toma)', async () => {
    api.en('POST', '/tomas-inventario/toma-1/resolver', () => {
      api.en('GET', '/tomas-inventario/toma-1', resuelta)
      return resuelta
    })
    abrir()
    await screen.findByRole('button', { name: 'Resolver diferencias' })
    await elegir('Merma (13)', 'Ajuste (28)')
    await userEvent.type(screen.getByLabelText('Sustento de la merma (13)'), 'INFORME TÉCNICO DE MERMA DEMO')
    await userEvent.type(screen.getByLabelText('Sustento del ajuste (28)'), 'ACTA DE TOMA DEMO')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    await waitFor(() => expect(api.hechas('POST', '/tomas-inventario/toma-1/resolver')[0]?.cuerpo).toEqual({
      lineas: [{ productoId: 1, accion: 'MERMA' }, { productoId: 2, accion: 'AJUSTE' }],
      sustentoMerma: 'INFORME TÉCNICO DE MERMA DEMO',
      anioInforme: 2026,
      sustentoAjuste: 'ACTA DE TOMA DEMO',
    }))
    expect(toast.success).toHaveBeenCalledWith('Diferencias resueltas · comprobantes 00-IT-2026, 00-AI-0001 · kardex recalculado')
    expect(await screen.findByRole('button', { name: 'Cerrar toma' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Paso 4 de 4: Acciones y cierre' })).toHaveFocus())
  })

  it('Ninguna con observación: la observación viaja en su línea', async () => {
    api.en('POST', '/tomas-inventario/toma-1/resolver', resuelta)
    abrir()
    await screen.findByRole('button', { name: 'Resolver diferencias' })
    await elegir('Ninguna', 'Ninguna')
    await userEvent.type(within(grupo('FIERRO')).getByLabelText(/Observación/), 'Humedad')
    await userEvent.type(within(grupo('INOXIDABLE')).getByLabelText(/Observación/), 'Dentro de lo normal')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    await waitFor(() => expect(api.hechas('POST', '/tomas-inventario/toma-1/resolver')[0]?.cuerpo).toEqual({
      lineas: [{ productoId: 1, accion: 'NINGUNA', observacion: 'Humedad' }, { productoId: 2, accion: 'NINGUNA', observacion: 'Dentro de lo normal' }],
    }))
  })

  it('stock negativo: reutiliza el diálogo del S8 y reenvía con confirmarStockNegativo', async () => {
    api.en('POST', '/tomas-inventario/toma-1/resolver', (l: Llamada) => {
      if (!(l.cuerpo as { confirmarStockNegativo?: boolean }).confirmarStockNegativo) {
        throw new ErrorApi(409, 'STOCK_NEGATIVO_REQUIERE_CONFIRMACION', 'x', {
          productoId: 1, fecha: '2026-03-31', saldoResultante: '-0.2500', disponibleAntes: '0.0000',
        })
      }
      return resuelta
    })
    abrir()
    await screen.findByRole('button', { name: 'Resolver diferencias' })
    await elegir('Ajuste (28)', 'Ajuste (28)')
    await userEvent.type(screen.getByLabelText('Sustento del ajuste (28)'), 'ACTA DE TOMA DEMO')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    const dialogo = await screen.findByRole('alertdialog', { name: /El stock quedará en negativo/ })
    expect(within(dialogo).getAllByText('FIERRO · CHATARRA DE FIERRO DEMO').length).toBeGreaterThan(0)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar de todos modos' }))
    await waitFor(() => expect(api.hechas('POST', '/tomas-inventario/toma-1/resolver')).toHaveLength(2))
    expect(api.hechas('POST', '/tomas-inventario/toma-1/resolver')[1].cuerpo).toMatchObject({ confirmarStockNegativo: true })
  })

  it('TOMA_DESACTUALIZADA: ofrece «Volver a calcular», que registra una toma nueva con los mismos datos y la abre', async () => {
    api.en('POST', '/tomas-inventario/toma-1/resolver', () => { throw new ErrorApi(409, 'TOMA_DESACTUALIZADA', 'x') })
    api.en('POST', '/tomas-inventario', tomaDemo({ id: 'toma-2', creadoEn: '2026-04-02T15:30:00.000Z' }))
    api.en('GET', '/tomas-inventario/toma-2', tomaDemo({ id: 'toma-2', creadoEn: '2026-04-02T15:30:00.000Z' }))
    const { router } = abrir()
    await screen.findByRole('button', { name: 'Resolver diferencias' })
    await elegir('Ajuste (28)', 'Ajuste (28)')
    await userEvent.type(screen.getByLabelText('Sustento del ajuste (28)'), 'ACTA DE TOMA DEMO')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    expect(await screen.findByText('El kardex cambió después de registrar esta toma')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a calcular' }))
    await waitFor(() => expect(api.hechas('POST', '/tomas-inventario')[0]?.cuerpo).toEqual({
      fecha: '2026-03-31',
      establecimientoId: 1,
      responsable: 'Contadora (demo)',
      lineas: [
        { productoId: 1, cantidadContada: '14.7500' },
        { productoId: 2, cantidadContada: '10.5000' },
        { productoId: 3, cantidadContada: '2.5000' },
      ],
    }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/inventario/toma-inventario/toma-2'))
  })

  it.each([
    ['ACCION_NO_CORRESPONDE', 'La acción no corresponde a la diferencia: la merma solo se usa con faltantes.'],
    ['TOMA_YA_RESUELTA', 'Las diferencias de esta toma ya se resolvieron.'],
    ['TOMA_YA_CERRADA', 'Esta toma ya está cerrada: no se puede modificar.'],
  ])('error %s al resolver: mensaje claro', async (codigo, mensaje) => {
    api.en('POST', '/tomas-inventario/toma-1/resolver', () => { throw new ErrorApi(codigo === 'ACCION_NO_CORRESPONDE' ? 422 : 409, codigo, 'x') })
    abrir()
    await screen.findByRole('button', { name: 'Resolver diferencias' })
    await elegir('Ajuste (28)', 'Ajuste (28)')
    await userEvent.type(screen.getByLabelText('Sustento del ajuste (28)'), 'ACTA DE TOMA DEMO')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })

  it('PERIODO_CERRADO al resolver: mensaje con el mes', async () => {
    api.en('POST', '/tomas-inventario/toma-1/resolver', () => { throw new ErrorApi(409, 'PERIODO_CERRADO', 'x', { fecha: '2026-03-31' }) })
    abrir()
    await screen.findByRole('button', { name: 'Resolver diferencias' })
    await elegir('Ajuste (28)', 'Ajuste (28)')
    await userEvent.type(screen.getByLabelText('Sustento del ajuste (28)'), 'ACTA DE TOMA DEMO')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver diferencias' }))
    expect(await screen.findByText(/El mes de marzo de 2026 está cerrado/)).toBeInTheDocument()
  })

  it('resuelta: enlaces a la merma y al ajuste generados y «Cerrar toma» con confirmación', async () => {
    api.en('GET', '/tomas-inventario/toma-1', resuelta)
    api.en('POST', '/tomas-inventario/toma-1/cerrar', { ...resuelta, estado: 'CERRADA' })
    abrir()
    expect(await screen.findByText('Resuelta · falta cerrarla')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '00-IT-2026' })[0]).toHaveAttribute('href', '/inventario/comprobantes/comp-8')
    expect(screen.getAllByRole('link', { name: '00-AI-0001' })[0]).toHaveAttribute('href', '/inventario/comprobantes/comp-9')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar toma' }))
    const dialogo = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar toma' }))
    await waitFor(() => expect(api.hechas('POST', '/tomas-inventario/toma-1/cerrar')).toHaveLength(1))
    expect(toast.success).toHaveBeenCalledWith('Toma de inventario cerrada')
  })

  it('TOMA_CON_DIFERENCIAS_PENDIENTES al cerrar: mensaje claro', async () => {
    api.en('GET', '/tomas-inventario/toma-1', resuelta)
    api.en('POST', '/tomas-inventario/toma-1/cerrar', () => { throw new ErrorApi(409, 'TOMA_CON_DIFERENCIAS_PENDIENTES', 'x') })
    abrir()
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar toma' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cerrar toma' }))
    expect(await screen.findByText('Todavía hay productos con diferencia sin una acción. Resuélvelos antes de cerrar la toma.')).toBeInTheDocument()
  })

  it('reemplazada por una toma posterior de la misma fecha: lo avisa, enlaza a la vigente y no deja resolver', async () => {
    api.en('GET', '/tomas-inventario', [tomaDemo(), tomaDemo({ id: 'toma-2', creadoEn: '2026-04-02T15:30:00.000Z' })])
    abrir()
    expect(await screen.findByText(/^Reemplazada por la toma del 02\/04\/2026/, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir a la toma vigente' })).toHaveAttribute('href', '/inventario/toma-inventario/toma-2')
    expect(screen.queryByRole('button', { name: 'Resolver diferencias' })).not.toBeInTheDocument()
  })

  it('toma no encontrada: mensaje y Reintentar', async () => {
    api.en('GET', '/tomas-inventario/toma-x', () => { throw new ErrorApi(404, 'NO_ENCONTRADO', 'x') })
    abrir(['inventario:CONTADOR'], 'toma-x')
    expect(await screen.findByText('No encontramos ese registro (quizá fue anulado).')).toBeInTheDocument()
  })
})
