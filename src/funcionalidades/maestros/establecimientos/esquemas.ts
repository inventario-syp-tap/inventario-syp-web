// Establecimiento (docs/UI-UX.md §5.16): código de 4 dígitos (no se edita) y texto del encabezado del libro 12.1.
import { z } from 'zod'
import type { DatosCrearEstablecimiento, DatosEditarEstablecimiento, Establecimiento } from '@/api/establecimientos'

export const esquemaEstablecimiento = z.object({
  codigo: z.string().trim().regex(/^\d{4}$/, 'El código tiene 4 dígitos (por ejemplo 0002).'),
  nombre: z.string().trim().toUpperCase().min(1, 'Escribe el nombre.').max(100, 'Máximo 100 caracteres.'),
  textoLibro: z.string().trim().max(120, 'Máximo 120 caracteres.'),
  activo: z.boolean(),
})

export type FormularioEstablecimiento = z.infer<typeof esquemaEstablecimiento>
export const CAMPOS_ESTABLECIMIENTO = ['codigo', 'nombre', 'textoLibro', 'activo'] as const

/** Texto que propone la API si no se escribe: "<codigo>-<nombre>". */
export const textoLibroPorDefecto = (codigo: string, nombre: string) =>
  codigo.trim() && nombre.trim() ? `${codigo.trim()}-${nombre.trim().toUpperCase()}` : ''

export const valoresIniciales = (e?: Establecimiento): FormularioEstablecimiento =>
  e ? { codigo: e.codigo, nombre: e.nombre, textoLibro: e.textoLibro, activo: e.activo } : { codigo: '', nombre: '', textoLibro: '', activo: true }

export function aCrear(datos: FormularioEstablecimiento): DatosCrearEstablecimiento {
  return { codigo: datos.codigo, nombre: datos.nombre, ...(datos.textoLibro ? { textoLibro: datos.textoLibro } : {}) }
}

export function aEditar(datos: FormularioEstablecimiento, original: Establecimiento): DatosEditarEstablecimiento {
  const cambios: DatosEditarEstablecimiento = {}
  if (datos.nombre !== original.nombre) cambios.nombre = datos.nombre
  if (datos.textoLibro && datos.textoLibro !== original.textoLibro) cambios.textoLibro = datos.textoLibro
  if (datos.activo !== original.activo) cambios.activo = datos.activo
  return cambios
}
