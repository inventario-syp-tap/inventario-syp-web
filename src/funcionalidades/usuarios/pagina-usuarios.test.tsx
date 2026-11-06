import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginaUsuarios } from './pagina-usuarios'
import { solicitar } from '@/api/cliente'
import { temporalVencida, type Usuario } from '@/api/usuarios'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarConSesion } from '@/pruebas/api-falsa'
import { usuarioDemo } from '@/pruebas/falsos'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Usuarios de demostración (@syp.invalid). La sesión de la prueba es la de usuarioDemo (mismo id que `yo`).
const yo: Usuario = {
  id: usuarioDemo().id, email: 'admin@syp.invalid', nombre: 'Administrador (demo)', roles: ['ADMIN'], activo: true,
  debeCambiarPassword: false, passwordTemporalExpira: null, bloqueado: false, ultimoAcceso: '2026-10-20T14:30:00.000Z',
  creadoEn: '2026-10-01T09:00:00.000Z',
}
const contadora: Usuario = {
  ...yo, id: '00000000-0000-4000-8000-000000000002', email: 'contadora.demo@syp.invalid', nombre: 'Contadora (demo)',
  roles: ['CONTADOR'], debeCambiarPassword: true, passwordTemporalExpira: '2020-01-01T00:00:00.000Z', ultimoAcceso: null,
}
const TEMPORAL = 'clave-temporal-de-ejemplo'

const api = crearApiFalsa()
const escribirPortapapeles = vi.fn<(texto: string) => Promise<void>>()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  api.en('GET', '/usuarios', { datos: [yo, contadora], total: 2, pagina: 1, tamano: 50 })
  escribirPortapapeles.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribirPortapapeles }, configurable: true })
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const renderizar = () => renderizarConSesion(<PaginaUsuarios />, ['inventario:ADMIN'])
const fila = async (email: string) => (await screen.findByText(email)).closest('tr') as HTMLElement

describe('temporalVencida', () => {
  it('compara el instante de vencimiento con ahora; null no vence', () => {
    const ahora = Date.parse('2026-10-04T09:00:00.000Z')
    expect(temporalVencida({ passwordTemporalExpira: '2026-10-04T08:59:59.000Z' }, ahora)).toBe(true)
    expect(temporalVencida({ passwordTemporalExpira: '2026-10-04T09:00:01.000Z' }, ahora)).toBe(false)
    expect(temporalVencida({ passwordTemporalExpira: null }, ahora)).toBe(false)
  })
})

describe('Usuarios', () => {
  it('lista roles en chips y avisa la temporal vencida con ícono y texto', async () => {
    renderizar()
    const filaContadora = await fila('contadora.demo@syp.invalid')
    expect(within(filaContadora).getByText('Contador')).toBeInTheDocument()
    expect(within(filaContadora).getByText('Temporal vencida: restablécela')).toBeInTheDocument()
  })

  it('crear: la contraseña temporal se muestra una sola vez y se puede copiar', async () => {
    api.en('POST', '/usuarios', {
      passwordTemporal: TEMPORAL,
      usuario: { ...contadora, id: '00000000-0000-4000-8000-000000000003', email: 'asistente.demo@syp.invalid', roles: ['ASISTENTE'] },
    })
    renderizar()
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo usuario' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo usuario' })
    await userEvent.click(within(dialogo).getByRole('button', { name: /Crear usuario/ }))
    expect(await within(dialogo).findByText('Elige al menos un rol.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Escribe el correo.')).toBeInTheDocument()

    await userEvent.type(within(dialogo).getByLabelText('Correo'), 'Asistente.Demo@syp.invalid')
    await userEvent.type(within(dialogo).getByLabelText('Nombre'), 'Asistente (demo)')
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Asistente' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: /Crear usuario/ }))
    await waitFor(() => expect(api.hechas('POST', '/usuarios')).toHaveLength(1))
    expect(api.hechas('POST', '/usuarios')[0].cuerpo).toEqual({ email: 'asistente.demo@syp.invalid', nombre: 'Asistente (demo)', roles: ['ASISTENTE'] })

    const temporal = await screen.findByRole('dialog', { name: 'Contraseña temporal' })
    expect(within(temporal).getByText(TEMPORAL)).toBeInTheDocument()
    expect(within(temporal).getByText(/No se volverá a mostrar/)).toBeInTheDocument()
    await userEvent.click(within(temporal).getByRole('button', { name: 'Copiar' }))
    expect(escribirPortapapeles).toHaveBeenCalledWith(TEMPORAL)
    expect(await within(temporal).findByText('Contraseña copiada al portapapeles.')).toBeInTheDocument()

    await userEvent.click(within(temporal).getByRole('button', { name: 'Ya la guardé' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Contraseña temporal' })).not.toBeInTheDocument())
    // Ya no está en ningún lugar de la página
    expect(screen.queryByText(TEMPORAL)).not.toBeInTheDocument()
  })

  it('restablecer pide confirmación y muestra la temporal nueva', async () => {
    api.en('POST', `/usuarios/${contadora.id}/restablecer-password`, { passwordTemporal: TEMPORAL })
    renderizar()
    await userEvent.click(within(await fila('contadora.demo@syp.invalid')).getByRole('button', { name: 'Restablecer contraseña de Contadora (demo)' }))
    const confirmacion = await screen.findByRole('alertdialog', { name: '¿Restablecer la contraseña de Contadora (demo)?' })
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Restablecer' }))
    expect(await screen.findByText(TEMPORAL)).toBeInTheDocument()
  })

  it('desactivar pide confirmación y envía activo: false', async () => {
    api.en('PATCH', `/usuarios/${contadora.id}`, { ...contadora, activo: false })
    renderizar()
    await userEvent.click(within(await fila('contadora.demo@syp.invalid')).getByRole('button', { name: 'Desactivar a Contadora (demo)' }))
    const confirmacion = await screen.findByRole('alertdialog', { name: '¿Desactivar a Contadora (demo)?' })
    expect(confirmacion).toHaveTextContent('se cerrarán todas sus sesiones')
    await userEvent.click(within(confirmacion).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() => expect(api.hechas('PATCH', `/usuarios/${contadora.id}`)[0]?.cuerpo).toEqual({ activo: false }))
  })

  it('el ADMIN no puede desactivarse ni quitarse el rol de administrador', async () => {
    renderizar()
    const miFila = await fila('admin@syp.invalid')
    expect(within(miFila).queryByRole('button', { name: /Desactivar/ })).not.toBeInTheDocument()
    await userEvent.click(within(miFila).getByRole('button', { name: 'Editar a Administrador (demo)' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar a Administrador (demo)' })
    expect(within(dialogo).getByRole('checkbox', { name: 'Administrador' })).toBeDisabled()
    expect(within(dialogo).getByLabelText('Correo')).toHaveAttribute('readonly')
  })

  it('editar roles envía solo los roles, sin prefijo', async () => {
    api.en('PATCH', `/usuarios/${contadora.id}`, { ...contadora, roles: ['CONTADOR', 'ASISTENTE'] })
    renderizar()
    await userEvent.click(within(await fila('contadora.demo@syp.invalid')).getByRole('button', { name: 'Editar a Contadora (demo)' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar a Contadora (demo)' })
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: 'Asistente' }))
    await userEvent.click(within(dialogo).getByRole('button', { name: /Guardar/ }))
    await waitFor(() => expect(api.hechas('PATCH', `/usuarios/${contadora.id}`)[0]?.cuerpo).toEqual({ roles: ['CONTADOR', 'ASISTENTE'] }))
  })
})
