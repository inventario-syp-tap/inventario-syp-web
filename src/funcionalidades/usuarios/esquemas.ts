// Usuarios (docs/UI-UX.md §5.18). Los roles van sin prefijo hacia /usuarios ("CONTADOR").
import { z } from 'zod'
import type { RolUsuario } from '@/api/usuarios'

export const ROLES_USUARIO = ['ADMIN', 'CONTADOR', 'ASISTENTE', 'CONSULTA'] as const satisfies readonly RolUsuario[]

export const NOMBRE_ROL: Record<RolUsuario, { nombre: string; ayuda: string }> = {
  ADMIN: { nombre: 'Administrador', ayuda: 'Usuarios, configuración, importación, respaldo y todo lo de la contadora.' },
  CONTADOR: { nombre: 'Contador', ayuda: 'Registra operaciones, cierra meses, imprime el libro 12.1 y exporta a WinConta.' },
  ASISTENTE: { nombre: 'Asistente', ayuda: 'Registra compras y ventas, y consulta.' },
  CONSULTA: { nombre: 'Consulta', ayuda: 'Solo lectura.' },
}

const roles = z.array(z.enum(ROLES_USUARIO)).min(1, 'Elige al menos un rol.')
const nombre = z.string().trim().min(1, 'Escribe el nombre.').max(120, 'Máximo 120 caracteres.')

export const esquemaNuevoUsuario = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Escribe el correo.').max(120, 'Máximo 120 caracteres.')
    .pipe(z.email('Escribe un correo válido.')),
  nombre,
  roles,
})
export type FormularioNuevoUsuario = z.infer<typeof esquemaNuevoUsuario>

export const esquemaEditarUsuario = z.object({ nombre, roles })
export type FormularioEditarUsuario = z.infer<typeof esquemaEditarUsuario>
