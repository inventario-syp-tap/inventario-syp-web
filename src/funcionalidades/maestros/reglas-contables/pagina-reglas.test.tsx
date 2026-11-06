import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { esquemaCrearRegla, formatearMes, reglaCerrada, valoresCrear } from './esquemas'
import { PaginaReglas } from './pagina-reglas'
import { solicitar } from '@/api/cliente'
import type { ReglaContable } from '@/api/reglas-contables'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { catalogosDemo, crearApiFalsa, renderizarConSesion } from '@/pruebas/api-falsa'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Cuentas y códigos de ejemplo (docs/UI-UX.md §5.13 los usa como ilustrativos).
const vigente: ReglaContable = {
  id: 1, codigo: 'RC-09', tipoAsiento: 'COSTO_VENTAS', productoId: 1, productoCodigo: 'D-FIERRO', tipoOperacion: '01',
  cuentaDebe: '691101', cuentaHaber: '201101', vigenteDesde: '2026-01', vigenteHasta: null, decision: 'D-demo',
  descripcion: 'Costo de ventas nacional - fierro (demo)', activo: true,
}
const cerrada: ReglaContable = { ...vigente, id: 2, codigo: 'RC-08', vigenteDesde: '2024-01', vigenteHasta: '2025-12' }

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/catalogos', catalogosDemo)
  api.en('GET', '/reglas-contables', [vigente, cerrada])
  api.en('GET', '/productos', [{
    id: 1, codigo: 'D-FIERRO', codigoLibro: 'DEMO 001', descripcion: 'CHATARRA DE FIERRO', tipoExistencia: '01',
    unidadMedida: 'TNE', metodoValuacion: '1', cuentaInventario: '201101', cuentaCostoVentas: '691101',
    denominacionContable: 'CHATARRA DE FIERRO (DEMO)', activo: true,
  }])
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

describe('esquemas de reglas', () => {
  it('valida AAAA-MM, el orden de la vigencia y la operación del asiento', () => {
    const base = { ...valoresCrear(), productoId: '1', cuentaDebe: '691101', cuentaHaber: '201101', decision: 'D-demo', descripcion: 'x' }
    const mensajes = (datos: object) => esquemaCrearRegla.safeParse(datos).error?.issues.map((i) => i.message) ?? []
    expect(mensajes({ ...base, vigenteDesde: '2026-13' })).toContain('Usa el formato AAAA-MM (por ejemplo 2026-01).')
    expect(mensajes({ ...base, vigenteDesde: '2026-05', vigenteHasta: '2026-04' })).toContain('"Vigente hasta" no puede ser anterior a "vigente desde".')
    expect(mensajes({ ...base, vigenteDesde: '2026-01', tipoAsiento: 'MERMA', tipoOperacion: '01' })).toContain('Esa operación no corresponde al tipo de asiento.')
    expect(mensajes({ ...base, vigenteDesde: '2026-01', tipoAsiento: 'MERMA', tipoOperacion: '13' })).toEqual([])
  })

  it('formatea la vigencia y sabe si una regla está cerrada', () => {
    expect(formatearMes('2026-09')).toBe('Setiembre 2026')
    expect(formatearMes(null)).toBe('sin fin')
    expect(reglaCerrada({ vigenteHasta: '2025-12' }, '2026-03')).toBe(true)
    expect(reglaCerrada({ vigenteHasta: '2026-03' }, '2026-03')).toBe(false)
    expect(reglaCerrada({ vigenteHasta: null }, '2026-03')).toBe(false)
  })
})

describe('Reglas contables', () => {
  it('lista con estado en texto y sin "Cerrar regla" en las ya cerradas', async () => {
    renderizarConSesion(<PaginaReglas />)
    const filaVigente = (await screen.findByText('RC-09')).closest('tr') as HTMLElement
    expect(within(filaVigente).getByText('Vigente')).toBeInTheDocument()
    expect(within(filaVigente).getByText('sin fin')).toBeInTheDocument()
    const filaCerrada = screen.getByText('RC-08').closest('tr') as HTMLElement
    expect(within(filaCerrada).getByText('Cerrada')).toBeInTheDocument()
    expect(within(filaCerrada).queryByRole('button', { name: 'Cerrar regla RC-08' })).not.toBeInTheDocument()
  })

  it('crear: filtra las operaciones por tipo de asiento y envía el producto como número', async () => {
    api.en('POST', '/reglas-contables', { ...vigente, id: 3, codigo: 'RC-10' })
    renderizarConSesion(<PaginaReglas />)
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva regla' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva regla contable' })
    const operacion = within(dialogo).getByLabelText('Operación (Tabla 12)')
    expect(within(operacion).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['01', '17'])
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo de asiento'), 'MERMA')
    await waitFor(() => expect(within(operacion).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['13']))

    await userEvent.selectOptions(within(dialogo).getByLabelText('Producto'), '1')
    await userEvent.type(within(dialogo).getByLabelText('Cuenta Debe'), '695101')
    await userEvent.type(within(dialogo).getByLabelText('Cuenta Haber'), '201101')
    await userEvent.type(within(dialogo).getByLabelText('Vigente desde (AAAA-MM)'), '2026-01')
    await userEvent.type(within(dialogo).getByLabelText('Decisión (sustento)'), 'D-demo')
    await userEvent.type(within(dialogo).getByLabelText('Descripción'), 'Merma de fierro (demo)')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('POST', '/reglas-contables')).toHaveLength(1))
    expect(api.hechas('POST', '/reglas-contables')[0].cuerpo).toEqual({
      tipoAsiento: 'MERMA', productoId: 1, tipoOperacion: '13', cuentaDebe: '695101', cuentaHaber: '201101',
      vigenteDesde: '2026-01', vigenteHasta: null, decision: 'D-demo', descripcion: 'Merma de fierro (demo)',
    })
  })

  it('409 VIGENCIA_SUPERPUESTA: mensaje claro con la vigencia pedida y las de las otras reglas', async () => {
    api.en('POST', '/reglas-contables', () => { throw new ErrorApi(409, 'VIGENCIA_SUPERPUESTA', 'x') })
    renderizarConSesion(<PaginaReglas />)
    await userEvent.click(await screen.findByRole('button', { name: 'Nueva regla' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nueva regla contable' })
    await userEvent.selectOptions(within(dialogo).getByLabelText('Producto'), '1')
    await userEvent.type(within(dialogo).getByLabelText('Cuenta Debe'), '691101')
    await userEvent.type(within(dialogo).getByLabelText('Cuenta Haber'), '201101')
    await userEvent.type(within(dialogo).getByLabelText('Vigente desde (AAAA-MM)'), '2026-06')
    await userEvent.type(within(dialogo).getByLabelText('Decisión (sustento)'), 'D-demo')
    await userEvent.type(within(dialogo).getByLabelText('Descripción'), 'Otra regla (demo)')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'Ya existe una regla vigente en esas fechas para el mismo tipo, producto y operación. Cierra la anterior con "vigente hasta".')
    expect(within(dialogo).getByText(/Vigencia que intentaste:/).parentElement).toHaveTextContent('Junio 2026 – sin fin')
    expect(within(dialogo).getByText('RC-09').parentElement).toHaveTextContent('RC-09: Enero 2026 – sin fin')
  })

  it('editar: tipo, producto, operación y cuentas en solo lectura; envía solo los 3 campos que cambian', async () => {
    api.en('PATCH', '/reglas-contables/1', { ...vigente, descripcion: 'Nueva descripción (demo)' })
    renderizarConSesion(<PaginaReglas />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar RC-09' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar la regla RC-09' })
    expect(within(dialogo).queryByLabelText('Cuenta Debe')).not.toBeInTheDocument()
    expect(within(dialogo).getByText('691101 · 201101')).toBeInTheDocument()
    const descripcion = within(dialogo).getByLabelText('Descripción')
    await userEvent.clear(descripcion)
    await userEvent.type(descripcion, 'Nueva descripción (demo)')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('PATCH', '/reglas-contables/1')).toHaveLength(1))
    expect(api.hechas('PATCH', '/reglas-contables/1')[0].cuerpo).toEqual({ descripcion: 'Nueva descripción (demo)' })
  })

  it('cerrar regla = poner vigente hasta (obligatorio y no anterior al inicio)', async () => {
    api.en('PATCH', '/reglas-contables/1', { ...vigente, vigenteHasta: '2026-12' })
    renderizarConSesion(<PaginaReglas />)
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar regla RC-09' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cerrar la regla RC-09' })
    const hasta = within(dialogo).getByLabelText('Vigente hasta (AAAA-MM)')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Cerrar regla/ }))
    expect(await within(dialogo).findByText('Usa el formato AAAA-MM (por ejemplo 2026-01).')).toBeInTheDocument()
    await userEvent.type(hasta, '2025-12')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Cerrar regla/ }))
    expect(await within(dialogo).findByText('"Vigente hasta" no puede ser anterior a "vigente desde".')).toBeInTheDocument()
    await userEvent.clear(hasta)
    await userEvent.type(hasta, '2026-12')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Cerrar regla/ }))
    await waitFor(() => expect(api.hechas('PATCH', '/reglas-contables/1')[0]?.cuerpo).toEqual({ vigenteHasta: '2026-12' }))
  })

  it('ASISTENTE y CONSULTA no ven Nueva, Editar ni Cerrar', async () => {
    renderizarConSesion(<PaginaReglas />, ['inventario:ASISTENTE'])
    await screen.findByText('RC-09')
    expect(screen.queryByRole('button', { name: 'Nueva regla' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar|Cerrar/ })).not.toBeInTheDocument()
  })
})
