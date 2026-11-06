import { afterEach, describe, expect, it } from 'vitest'
import { A_C, puede, tieneAlgunRol, tieneRol } from './roles'
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
