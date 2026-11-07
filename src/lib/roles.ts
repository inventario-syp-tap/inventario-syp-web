// Roles con prefijo de módulo ("inventario:CONTADOR"). Toda consulta de permisos pasa por aquí.
// La API valida igual: esto solo decide qué se muestra.
import { obtenerSesion, useSesion } from './sesion'

export type Modulo = 'inventario'
export type Rol = 'ADMIN' | 'CONTADOR' | 'ASISTENTE' | 'CONSULTA'

/** Atajos de docs/UI-UX.md §3 (A, C, S; "todos" incluye CONSULTA). */
export const TODOS: readonly Rol[] = ['ADMIN', 'CONTADOR', 'ASISTENTE', 'CONSULTA']
export const A_C_S: readonly Rol[] = ['ADMIN', 'CONTADOR', 'ASISTENTE']
export const A_C: readonly Rol[] = ['ADMIN', 'CONTADOR']
export const SOLO_A: readonly Rol[] = ['ADMIN']

const rolesActuales = () => obtenerSesion().usuario?.roles ?? []

/** tieneRol('inventario', 'CONTADOR'). Sin `roles` usa los de la sesión actual. */
export function tieneRol(modulo: Modulo, rol: Rol, roles: readonly string[] = rolesActuales()): boolean {
  return roles.includes(`${modulo}:${rol}`)
}

/** true si tiene al menos uno de los roles. */
export function tieneAlgunRol(modulo: Modulo, permitidos: readonly Rol[], roles: readonly string[] = rolesActuales()): boolean {
  return permitidos.some((rol) => tieneRol(modulo, rol, roles))
}

/**
 * Acciones de escritura y quién puede hacerlas: la misma matriz que valida la API (docs/UI-UX.md §3 y
 * docs/CONTRATO-API.md §6). Sin permiso, la acción no se muestra (o el campo queda en solo lectura).
 */
export const PERMISOS = {
  'productos:editar': A_C,
  'terceros:editar': A_C_S,
  'reglas:editar': A_C,
  'establecimientos:editar': SOLO_A,
  'configuracion:empresa': SOLO_A,
  'configuracion:libro': A_C,
  'configuracion:winconta': A_C,
  'configuracion:toma': SOLO_A,
  'usuarios:administrar': SOLO_A,
  'compras:registrar': A_C_S,
  'ventas:registrar': A_C_S,
  'mermas:registrar': A_C,
  'ajustes:registrar': A_C,
  'comprobantes:anular': A_C,
} as const satisfies Record<string, readonly Rol[]>

export type Accion = keyof typeof PERMISOS

/** puede('reglas:editar'). Sin `roles` usa los de la sesión actual. */
export function puede(accion: Accion, roles: readonly string[] = rolesActuales()): boolean {
  return tieneAlgunRol('inventario', PERMISOS[accion], roles)
}

/**
 * Editar un comprobante registrado: ADMIN y CONTADOR, cualquiera; ASISTENTE, solo compras y ventas. La API además
 * exige que el ASISTENTE lo haya registrado él (responde 403): el contrato aún no dice quién lo creó (pendiente
 * `creadoPorId` para la API del S9), así que aquí no se puede filtrar por autor.
 */
export function puedeEditarComprobante(
  comprobante: { naturaleza: string; estado: string },
  roles: readonly string[] = rolesActuales(),
): boolean {
  if (comprobante.estado !== 'REGISTRADO') return false
  if (tieneAlgunRol('inventario', A_C, roles)) return true
  return tieneRol('inventario', 'ASISTENTE', roles) && (comprobante.naturaleza === 'COMPRA' || comprobante.naturaleza === 'VENTA')
}

/** Igual que `puede`, pero se vuelve a evaluar si cambia la sesión (para componentes). */
export function usePuede(accion: Accion): boolean {
  const { usuario } = useSesion()
  return puede(accion, usuario?.roles ?? [])
}
