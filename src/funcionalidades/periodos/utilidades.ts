// Funciones puras de Periodos y del cierre anual (sin componentes; se prueban aparte).
import type { Periodo } from '@/api/periodos'
import { formatearDecimal, hoyIso } from '@/lib/formato'

/**
 * Qué meses se pueden cerrar y cuál reabrir (lo que no corresponde no se muestra; la API valida igual):
 *  - cerrar: no está cerrado, no es posterior al mes en curso y el mes anterior del año no está abierto
 *    (enero depende de diciembre del año anterior: lo valida la API con PERIODO_ANTERIOR_ABIERTO);
 *  - reabrir: solo el último mes cerrado del año.
 */
export function accionesPorMes(meses: readonly Periodo[], hoy = hoyIso()): { cerrables: Set<number>; reabrible: number | null } {
  const enCurso = hoy.slice(0, 7)
  const cerrables = new Set<number>()
  for (const p of meses) {
    if (p.estado === 'CERRADO' || p.periodo > enCurso) continue
    const anterior = meses.find((m) => m.mes === p.mes - 1)
    if (!anterior || anterior.estado !== 'ABIERTO') cerrables.add(p.mes)
  }
  const cerrados = meses.filter((m) => m.estado === 'CERRADO').map((m) => m.mes)
  return { cerrables, reabrible: cerrados.length > 0 ? Math.max(...cerrados) : null }
}

/** Diferencia con signo explícito: "0.01" → "+0.01", "-2.5" → "-2.50", "0" → "0.00" (big.js en formatearDecimal). */
export function conSigno(valor: string | null | undefined, decimales: number): string {
  const texto = formatearDecimal(valor, decimales)
  return texto === '—' || texto.startsWith('-') || !/[1-9]/.test(texto) ? texto : `+${texto}`
}

/**
 * Nombre en español de cada total del cierre (claves de TotalesCierreDto). La API manda el campo como dato
 * estructurado en `diferenciasConCierreAnterior[].campo`: solo se traduce la clave, no se analiza ningún texto.
 */
export const NOMBRE_CAMPO_CIERRE: Readonly<Record<string, string>> = {
  siCantidad: 'saldo inicial TN',
  siCosto: 'saldo inicial S/',
  comprasCantidad: 'compras TN',
  comprasCosto: 'compras S/',
  otrasEntradasCantidad: 'otras entradas TN',
  otrasEntradasCosto: 'otras entradas S/',
  ventasCantidad: 'ventas TN',
  costoVentas: 'costo de ventas S/',
  mermasCantidad: 'mermas TN',
  mermasCosto: 'mermas S/',
  desmedrosCantidad: 'desmedros TN',
  desmedrosCosto: 'desmedros S/',
  otrasSalidasCantidad: 'otras salidas TN',
  otrasSalidasCosto: 'otras salidas S/',
  sfCantidad: 'saldo final TN',
  sfCosto: 'saldo final S/',
}

/** Nombre en español del campo; uno que no esté en la tabla se muestra tal cual (no se oculta). */
export const nombreCampoCierre = (campo: string) =>
  Object.hasOwn(NOMBRE_CAMPO_CIERRE, campo) ? NOMBRE_CAMPO_CIERRE[campo] : campo

/** El decimal (texto) es negativo; solo mira el signo, no convierte a number. */
export const negativo = (valor: string | null | undefined) => {
  const texto = (valor ?? '').trim()
  return texto.startsWith('-') && /[1-9]/.test(texto)
}
