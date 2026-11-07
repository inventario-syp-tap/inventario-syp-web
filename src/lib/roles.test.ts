import { afterEach, describe, expect, it } from 'vitest'
import { A_C, puede, puedeEditarComprobante, tieneAlgunRol, tieneRol } from './roles'
import { establecerSesion, reiniciarSesionParaPruebas } from './sesion'

const usuario = (roles: string[]) => ({
  id: 'u-1', email: 'contadora.demo@syp.invalid', nombre: 'Contadora (demo)', roles, debeCambiarPassword: false,
})

afterEach(() => reiniciarSesionParaPruebas())

describe('roles con prefijo de módulo', () => {
  it('tieneRol usa los roles de la sesión actual', () => {
    establecerSesion('token-demo', usuario(['inventario:CONTADOR']))
    expect(tieneRol('inventario', 'CONTADOR')).toBe(true)
    expect(tieneRol('inventario', 'ADMIN')).toBe(false)
  })

  it('no confunde el rol de otro módulo', () => {
    expect(tieneRol('inventario', 'ADMIN', ['planix:ADMIN', 'ADMIN'])).toBe(false)
  })

  it('sin sesión no tiene ningún rol', () => {
    expect(tieneRol('inventario', 'CONSULTA')).toBe(false)
  })

  it('tieneAlgunRol con la lista de la ruta', () => {
    expect(tieneAlgunRol('inventario', A_C, ['inventario:ADMIN'])).toBe(true)
    expect(tieneAlgunRol('inventario', A_C, ['inventario:CONSULTA'])).toBe(false)
  })
})

describe('puede (matriz de permisos del S7)', () => {
  it('coincide con la API', () => {
    expect(puede('terceros:editar', ['inventario:ASISTENTE'])).toBe(true)
    expect(puede('productos:editar', ['inventario:ASISTENTE'])).toBe(false)
    expect(puede('reglas:editar', ['inventario:CONTADOR'])).toBe(true)
    expect(puede('establecimientos:editar', ['inventario:CONTADOR'])).toBe(false)
    expect(puede('configuracion:libro', ['inventario:CONTADOR'])).toBe(true)
    expect(puede('configuracion:empresa', ['inventario:CONTADOR'])).toBe(false)
    expect(puede('usuarios:administrar', ['inventario:ADMIN'])).toBe(true)
    expect(puede('terceros:editar', ['inventario:CONSULTA'])).toBe(false)
  })
})

describe('comprobantes (S8)', () => {
  it('registrar: compra y venta A, C, S; merma y ajuste A, C; anular A, C', () => {
    expect(puede('compras:registrar', ['inventario:ASISTENTE'])).toBe(true)
    expect(puede('mermas:registrar', ['inventario:ASISTENTE'])).toBe(false)
    expect(puede('comprobantes:anular', ['inventario:ASISTENTE'])).toBe(false)
    expect(puede('comprobantes:anular', ['inventario:CONTADOR'])).toBe(true)
    expect(puede('ventas:registrar', ['inventario:CONSULTA'])).toBe(false)
  })

  it('editar: A y C todo lo registrado; S solo compras y ventas; nadie un anulado', () => {
    const merma = { naturaleza: 'MERMA', estado: 'REGISTRADO' }
    const compra = { naturaleza: 'COMPRA', estado: 'REGISTRADO' }
    expect(puedeEditarComprobante(merma, ['inventario:CONTADOR'])).toBe(true)
    expect(puedeEditarComprobante(merma, ['inventario:ASISTENTE'])).toBe(false)
    expect(puedeEditarComprobante(compra, ['inventario:ASISTENTE'])).toBe(true)
    expect(puedeEditarComprobante(compra, ['inventario:CONSULTA'])).toBe(false)
    expect(puedeEditarComprobante({ ...compra, estado: 'ANULADO' }, ['inventario:ADMIN'])).toBe(false)
  })
})
