// Ayudas para formularios con react-hook-form: errores de la API junto a cada campo y textos opcionales.
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { camposConError, mensajeDeError } from './errores'

/**
 * Coloca los campos de un 400 VALIDACION junto a cada control (y enfoca el primero). Devuelve el mensaje general
 * para mostrar en el formulario, o null si todos los errores quedaron en sus campos.
 */
export function aplicarErrorDeApi<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  camposDelFormulario: readonly Path<T>[],
): string | null {
  const campos = camposConError(error)
  const propios = Object.entries(campos).filter((par): par is [Path<T>, string] =>
    camposDelFormulario.includes(par[0] as Path<T>))
  propios.forEach(([campo, mensaje], indice) => setError(campo, { type: 'api', message: mensaje }, { shouldFocus: indice === 0 }))
  if (propios.length > 0 && propios.length === Object.keys(campos).length) return null
  return mensajeDeError(error)
}

/** "" → null (campos opcionales que la API acepta como null). */
export const vacioANulo = (texto: string | undefined | null): string | null => {
  const limpio = (texto ?? '').trim()
  return limpio === '' ? null : limpio
}
