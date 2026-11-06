import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaTerceros } from './pagina-terceros'
import { solicitar } from '@/api/cliente'
import type { Tercero } from '@/api/terceros'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { catalogosDemo, crearApiFalsa, renderizarConSesion } from '@/pruebas/api-falsa'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Solo RUC de demostración que cumplen el módulo 11 (docs/UI-UX.md §10). 20000000002 es a propósito un RUC
// ficticio que NO lo cumple (la API simulada lo rechaza).
const proveedor: Tercero = {
  id: 1, tipoDocumento: '6', numeroDocumento: '20000000010', razonSocial: 'PROVEEDOR DEMO S.A.C.', pais: 'PE',
  esProveedor: true, esCliente: false, direccion: null, activo: true,
}
const exterior: Tercero = {
  id: 2, tipoDocumento: '0', numeroDocumento: null, razonSocial: 'EXPORT DEMO LTD', pais: 'US',
  esProveedor: false, esCliente: true, direccion: null, activo: true,
}

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/catalogos', catalogosDemo)
  api.en('GET', '/terceros', { datos: [proveedor, exterior], total: 2, pagina: 1, tamano: 50 })
  api.en('GET', '/terceros/validar-documento', ({ ruta }: { ruta: string }) => {
    const numero = new URLSearchParams(ruta.split('?')[1]).get('numero')
    if (numero === '20000000010') return { valido: true, numero, codigo: null, mensaje: null, terceroId: 1 }
    if (numero === '20000000028') return { valido: true, numero, codigo: null, mensaje: null, terceroId: null }
    return { valido: false, numero: null, codigo: 'RUC_INVALIDO', mensaje: 'RUC inválido', terceroId: null }
  })
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

async function abrirNuevo() {
  await userEvent.click(await screen.findByRole('button', { name: 'Nuevo cliente o proveedor' }))
  return screen.findByRole('dialog', { name: 'Nuevo cliente o proveedor' })
}

describe('Clientes y proveedores', () => {
  it('lista con documento en font-mono, rol y "Sin documento" para el tipo 0', async () => {
    renderizarConSesion(<PaginaTerceros />)
    expect(document.title).toBe('Clientes y proveedores · Inventario S&P')
    const fila = (await screen.findByText('PROVEEDOR DEMO S.A.C.')).closest('tr') as HTMLElement
    expect(within(fila).getByText('RUC 20000000010')).toHaveClass('font-mono')
    expect(within(fila).getByText('Proveedor')).toBeInTheDocument()
    const filaExterior = screen.getByText('EXPORT DEMO LTD').closest('tr') as HTMLElement
    expect(within(filaExterior).getByText('Sin documento')).toBeInTheDocument()
  })

  it('busca en la API con ?q= y filtra por rol', async () => {
    renderizarConSesion(<PaginaTerceros />)
    await screen.findByText('PROVEEDOR DEMO S.A.C.')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'DEMO')
    await waitFor(() => expect(api.llamadas.some((l) => l.ruta.includes('q=DEMO'))).toBe(true))
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'CLIENTE')
    await waitFor(() => expect(api.llamadas.some((l) => l.ruta.includes('rol=CLIENTE'))).toBe(true))
  })

  it('muestra el error de carga con Reintentar', async () => {
    api.en('GET', '/terceros', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x', undefined, 'req-1') })
    renderizarConSesion(<PaginaTerceros />)
    expect(await screen.findByText(/Ocurrió un error inesperado.*req-1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    // No se confunde con "no hay registros"
    expect(screen.queryByText('Aún no hay clientes ni proveedores.')).not.toBeInTheDocument()
  })

  it('valida el RUC en vivo: inválido, ya existente y válido', async () => {
    renderizarConSesion(<PaginaTerceros />)
    const dialogo = await abrirNuevo()
    const numero = within(dialogo).getByLabelText('Número de documento')

    await userEvent.type(numero, '20000000002')
    expect(await within(dialogo).findByText('El RUC no es válido (revisa los 11 dígitos).')).toBeInTheDocument()

    await userEvent.clear(numero)
    await userEvent.type(numero, '20000000010')
    expect(await within(dialogo).findByText('Ya existe un cliente o proveedor con ese documento.')).toBeInTheDocument()

    await userEvent.clear(numero)
    await userEvent.type(numero, '20000000028')
    expect(await within(dialogo).findByText('Documento válido.')).toBeInTheDocument()
  })

  it('no consulta la API mientras el RUC está incompleto y avisa el largo al guardar', async () => {
    renderizarConSesion(<PaginaTerceros />)
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Número de documento'), '2000')
    await userEvent.type(within(dialogo).getByLabelText('Razón social o nombre'), 'proveedor demo s.a.c.')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    expect(await within(dialogo).findByText('El RUC tiene 11 dígitos, sin espacios ni guiones.')).toBeInTheDocument()
    expect(api.hechas('GET', '/terceros/validar-documento')).toHaveLength(0)
    expect(api.hechas('POST', '/terceros')).toHaveLength(0)
  })

  it('tipo 0 no pide número y lo envía como null, con la razón social en mayúsculas', async () => {
    api.en('POST', '/terceros', { ...exterior, id: 3 })
    renderizarConSesion(<PaginaTerceros />)
    const dialogo = await abrirNuevo()
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo de documento (Tabla 2)'), '0')
    expect(within(dialogo).queryByLabelText('Número de documento')).not.toBeInTheDocument()
    await userEvent.type(within(dialogo).getByLabelText('Razón social o nombre'), 'export demo ltd')
    await userEvent.clear(within(dialogo).getByLabelText('País'))
    await userEvent.type(within(dialogo).getByLabelText('País'), 'us')
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Proveedor' }))
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Cliente' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('POST', '/terceros')).toHaveLength(1))
    expect(api.hechas('POST', '/terceros')[0].cuerpo).toEqual({
      tipoDocumento: '0', numeroDocumento: null, razonSocial: 'EXPORT DEMO LTD', pais: 'US',
      esProveedor: false, esCliente: true, direccion: null,
    })
  })

  it('exige marcar proveedor o cliente', async () => {
    renderizarConSesion(<PaginaTerceros />)
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Número de documento'), '20000000028')
    await userEvent.type(within(dialogo).getByLabelText('Razón social o nombre'), 'CLIENTE DEMO S.A.C.')
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Proveedor' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    expect(await within(dialogo).findByText('Marca si es proveedor, cliente o ambos.')).toBeInTheDocument()
  })

  it('409 TERCERO_DUPLICADO se muestra junto al número', async () => {
    api.en('POST', '/terceros', () => { throw new ErrorApi(409, 'TERCERO_DUPLICADO', 'duplicado') })
    renderizarConSesion(<PaginaTerceros />)
    const dialogo = await abrirNuevo()
    await userEvent.type(within(dialogo).getByLabelText('Número de documento'), '20000000028')
    await within(dialogo).findByText('Documento válido.')
    await userEvent.type(within(dialogo).getByLabelText('Razón social o nombre'), 'CLIENTE DEMO S.A.C.')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    const numero = within(dialogo).getByLabelText('Número de documento')
    await waitFor(() => expect(numero).toHaveAttribute('aria-invalid', 'true'))
    expect(numero).toHaveAccessibleDescription(expect.stringContaining('Ya existe un cliente o proveedor con ese documento.'))
  })

  it('al editar solo envía lo que cambió', async () => {
    api.en('PATCH', '/terceros/1', { ...proveedor, esCliente: true })
    renderizarConSesion(<PaginaTerceros />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar PROVEEDOR DEMO S.A.C.' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar cliente o proveedor' })
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Cliente' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('PATCH', '/terceros/1')).toHaveLength(1))
    expect(api.hechas('PATCH', '/terceros/1')[0].cuerpo).toEqual({ esCliente: true })
  })

  it('ASISTENTE puede crear y editar; CONSULTA solo ve la lista', async () => {
    const { unmount } = renderizarConSesion(<PaginaTerceros />, ['inventario:ASISTENTE'])
    expect(await screen.findByRole('button', { name: 'Nuevo cliente o proveedor' })).toBeInTheDocument()
    unmount()
    renderizarConSesion(<PaginaTerceros />, ['inventario:CONSULTA'])
    await screen.findByText('PROVEEDOR DEMO S.A.C.')
    expect(screen.queryByRole('button', { name: 'Nuevo cliente o proveedor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()
  })
})
