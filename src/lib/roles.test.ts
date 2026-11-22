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

  it('editar: A y C todo lo registrado; S solo sus compras y ventas (creadoPorId); nadie un anulado', () => {
    const yo = 'usuario-asistente'
    const merma = { naturaleza: 'MERMA', estado: 'REGISTRADO', creadoPorId: yo }
    const compra = { naturaleza: 'COMPRA', estado: 'REGISTRADO', creadoPorId: yo }
    const ajena = { ...compra, creadoPorId: 'otro-usuario' }
    expect(puedeEditarComprobante(merma, ['inventario:CONTADOR'], yo)).toBe(true)
    expect(puedeEditarComprobante(ajena, ['inventario:CONTADOR'], yo)).toBe(true)
    expect(puedeEditarComprobante(merma, ['inventario:ASISTENTE'], yo)).toBe(false)
    expect(puedeEditarComprobante(compra, ['inventario:ASISTENTE'], yo)).toBe(true)
    expect(puedeEditarComprobante(ajena, ['inventario:ASISTENTE'], yo)).toBe(false)
    expect(puedeEditarComprobante(compra, ['inventario:ASISTENTE'], undefined)).toBe(false)
    expect(puedeEditarComprobante(compra, ['inventario:CONSULTA'], yo)).toBe(false)
    expect(puedeEditarComprobante({ ...compra, estado: 'ANULADO' }, ['inventario:ADMIN'], yo)).toBe(false)
  })
})

describe('kardex, periodos y saldos (S9)', () => {
  it('S11: exportar a WinConta, editar el tonelaje y gestionar tomas solo A y C', () => {
    for (const accion of ['asientos:exportar', 'tonelaje:editar', 'tomas:gestionar'] as const) {
      expect(puede(accion, ['inventario:ADMIN'])).toBe(true)
      expect(puede(accion, ['inventario:CONTADOR'])).toBe(true)
      expect(puede(accion, ['inventario:ASISTENTE'])).toBe(false)
      expect(puede(accion, ['inventario:CONSULTA'])).toBe(false)
    }
  })

  it('reordenar A, C; recalcular solo A', () => {
    expect(puede('kardex:reordenar', ['inventario:CONTADOR'])).toBe(true)
    expect(puede('kardex:reordenar', ['inventario:ASISTENTE'])).toBe(false)
    expect(puede('kardex:recalcular', ['inventario:ADMIN'])).toBe(true)
    expect(puede('kardex:recalcular', ['inventario:CONTADOR'])).toBe(false)
  })

  it('cerrar, reabrir, cierre anual y saldo manual A, C; cerrar en bloque solo A', () => {
    for (const accion of ['periodos:cerrar', 'periodos:cierre-anual', 'saldos:editar'] as const) {
      expect(puede(accion, ['inventario:CONTADOR'])).toBe(true)
      expect(puede(accion, ['inventario:ASISTENTE'])).toBe(false)
      expect(puede(accion, ['inventario:CONSULTA'])).toBe(false)
    }
    expect(puede('periodos:cerrar-en-bloque', ['inventario:ADMIN'])).toBe(true)
    expect(puede('periodos:cerrar-en-bloque', ['inventario:CONTADOR'])).toBe(false)
  })
})

describe('libros y reportes (S10)', () => {
  it('registrar impresión, prueba de márgenes, 13.1 detallado (D-33) y Excel contadora: solo A y C', () => {
    for (const accion of ['libros:registrar-impresion', 'libros:prueba-margenes', 'libros:13-1-detallado', 'reportes:excel-contadora'] as const) {
      expect(puede(accion, ['inventario:ADMIN'])).toBe(true)
      expect(puede(accion, ['inventario:CONTADOR'])).toBe(true)
      expect(puede(accion, ['inventario:ASISTENTE'])).toBe(false)
      expect(puede(accion, ['inventario:CONSULTA'])).toBe(false)
    }
  })
})
