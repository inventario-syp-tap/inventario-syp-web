// Usuarios (docs/CONTRATO-API.md §6, solo ADMIN). Los roles van SIN prefijo ("CONTADOR").
// La contraseña temporal llega una sola vez (crear y restablecer): nunca se guarda en la caché de consultas.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'

/**
 * Usuario de la lista. `passwordTemporalExpira` (ISO, 72 h) indica hasta cuándo vale la contraseña temporal;
 * `null` = no vence. Pasada esa hora el login responde 401 y hay que restablecerla.
 */
export type Usuario = components['schemas']['UsuarioDto']
export type PaginaUsuarios = components['schemas']['UsuariosPaginaDto']
export type DatosCrearUsuario = components['schemas']['CrearUsuarioDto']
export type DatosEditarUsuario = components['schemas']['EditarUsuarioDto']
export type UsuarioCreado = components['schemas']['UsuarioCreadoDto']
export type PasswordTemporal = components['schemas']['PasswordTemporalDto']
export type RolUsuario = Usuario['roles'][number]

export const listarUsuarios = (pagina = 1, tamano = 50) =>
  solicitar<PaginaUsuarios>(`/usuarios?pagina=${pagina}&tamano=${tamano}`)

export const crearUsuario = (datos: DatosCrearUsuario) =>
  solicitar<UsuarioCreado>('/usuarios', { metodo: 'POST', cuerpo: datos })

export const editarUsuario = (id: string, datos: DatosEditarUsuario) =>
  solicitar<Usuario>(`/usuarios/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos })

export const restablecerPassword = (id: string) =>
  solicitar<PasswordTemporal>(`/usuarios/${encodeURIComponent(id)}/restablecer-password`, { metodo: 'POST' })

/** true si la contraseña temporal ya venció (es un instante ISO completo, no una fecha de negocio). */
export function temporalVencida(usuario: Pick<Usuario, 'passwordTemporalExpira'>, ahora = Date.now()): boolean {
  if (!usuario.passwordTemporalExpira) return false
  const vence = Date.parse(usuario.passwordTemporalExpira)
  return Number.isFinite(vence) && vence <= ahora
}

export function useUsuarios(pagina: number, tamano: number) {
  return useQuery({
    queryKey: [...CLAVES.usuarios, { pagina, tamano }],
    queryFn: () => listarUsuarios(pagina, tamano),
    placeholderData: keepPreviousData,
  })
}
