// Utilidades de periodos sin componentes (para el selector de año, el chip de estado y las pantallas S9).
import { formatearPeriodo, hoyIso } from './formato'

/** Primer año del histórico: el selector de año empieza aquí. */
export const ANIO_INICIAL = 2024

/** Año en curso en Lima (del texto de hoyIso, sin new Date). */
export const anioActual = () => Number.parseInt(hoyIso().slice(0, 4), 10)

/** Años para elegir: ANIO_INICIAL … año en curso (+ el elegido si cae fuera), del más reciente al más antiguo. */
export function aniosDisponibles(elegido?: number): number[] {
  const anios: number[] = []
  for (let a = anioActual(); a >= ANIO_INICIAL; a--) anios.push(a)
  if (elegido !== undefined && !anios.includes(elegido)) anios.push(elegido)
  return anios.sort((x, y) => y - x)
}

/** Año de la URL (?anio=2026) o, si no viene o no es válido, el valor por defecto. */
export function anioDeUrl(parametros: URLSearchParams, porDefecto = anioActual()): number {
  const texto = parametros.get('anio') ?? ''
  return /^\d{4}$/.test(texto) ? Number.parseInt(texto, 10) : porDefecto
}

/** "2026-03" → "Marzo 2026". */
export const textoAnioMes = (valor: string) =>
  formatearPeriodo(Number.parseInt(valor.slice(0, 4), 10), Number.parseInt(valor.slice(5, 7), 10))

export const TEXTO_ESTADO_PERIODO = {
  ABIERTO: 'Abierto',
  CERRADO: 'Cerrado',
  SIN_PERIODO: 'Sin periodo',
} as const
