// Formatos es-PE de docs/UI-UX.md §9. Los decimales llegan como string y se redondean con big.js
// (nunca Number ni parseFloat): miles con coma, decimal con punto y negativos con signo menos.
import Big from 'big.js'

const SIN_VALOR = '—'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

type Decimal = string | null | undefined

/** Redondea (mitad hacia arriba, como la API) y agrupa miles: "-1234.5" → "-1,234.50". */
export function formatearDecimal(valor: Decimal, decimales: number): string {
  if (valor === null || valor === undefined || valor.trim() === '') return SIN_VALOR
  let fijo: string
  try {
    fijo = new Big(valor.trim()).round(decimales, Big.roundHalfUp).toFixed(decimales)
  } catch {
    return valor
  }
  const negativo = fijo.startsWith('-')
  const [entero, fraccion] = (negativo ? fijo.slice(1) : fijo).split('.')
  const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const texto = fraccion ? `${agrupado}.${fraccion}` : agrupado
  // "-0.0000" se muestra como cero
  return negativo && /[1-9]/.test(texto) ? `-${texto}` : texto
}

/** Conteos enteros (filas, comprobantes): 1234 → "1,234". */
export const formatearEntero = (valor: number) => formatearDecimal(String(valor), 0)

/** Toneladas con 4 decimales: "1234.5" → "1,234.5000". */
export const formatearToneladas = (valor: Decimal) => formatearDecimal(valor, 4)

/** Soles con 2 decimales: "1234.5" → "S/ 1,234.50". */
export function formatearSoles(valor: Decimal): string {
  const texto = formatearDecimal(valor, 2)
  return texto === SIN_VALOR ? texto : `S/ ${texto}`
}

/** Costo unitario: 2 decimales (4 en el detalle). */
export const formatearCU = (valor: Decimal, detalle = false) => formatearDecimal(valor, detalle ? 4 : 2)

/** Tipo de cambio con 3 decimales. */
export const formatearTipoCambio = (valor: Decimal) => formatearDecimal(valor, 3)

const SUPERINDICE: Record<string, string> = {
  '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
}

/** Valor exacto en notación científica ("2.58e-10" → mantisa "2.58", exponente "-10"); null si es 0 o no es un número. */
function notacionCientifica(valor: Decimal): { mantisa: string; exponente: string } | null {
  let exacto: Big
  try {
    exacto = new Big((valor ?? '').trim())
  } catch {
    return null
  }
  if (exacto.eq(0)) return null
  const [mantisa, exponente] = exacto.toExponential().split('e')
  return { mantisa, exponente: exponente.replace('+', '') }
}

/**
 * Diferencia de paridad: 6 decimales (los de la tolerancia) y, si no es cero, el valor exacto en notación
 * científica legible: "2.58e-10" → "0.000000 (2.58 × 10⁻¹⁰)"; "0" → "0.000000".
 */
export function formatearDiferencia(valor: Decimal): string {
  const texto = formatearDecimal(valor, 6)
  const notacion = notacionCientifica(valor)
  if (!notacion) return texto
  const superindice = notacion.exponente.replace(/[-0-9]/g, (c) => SUPERINDICE[c])
  return `${texto} (${notacion.mantisa} × 10${superindice})`
}

/**
 * La misma diferencia dicha en palabras para lectores de pantalla (los superíndices no se leen bien):
 * "2.58e-10" → "0.000000, valor exacto 2.58 por 10 a la menos 10"; "0" → "0.000000".
 */
export function leerDiferencia(valor: Decimal): string {
  const texto = formatearDecimal(valor, 6)
  const notacion = notacionCientifica(valor)
  if (!notacion) return texto
  const enPalabras = (numero: string) => (numero.startsWith('-') ? `menos ${numero.slice(1)}` : numero)
  return `${texto}, valor exacto ${enPalabras(notacion.mantisa)} por 10 a la ${enPalabras(notacion.exponente)}`
}

/** "2026-03-15" → "15/03/2026", partiendo el texto (sin new Date: evita el corrimiento por zona horaria). */
export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return SIN_VALOR
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha)
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : fecha
}

const FECHA_HORA = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

/**
 * Instante ISO completo de la API ("2026-10-20T14:30:00.000Z": último acceso, vencimientos) en la hora local:
 * "20/10/2026 09:30". Solo para instantes con hora y zona; las fechas de negocio usan formatearFecha.
 */
export function formatearFechaHora(instante: string | null | undefined): string {
  if (!instante) return SIN_VALOR
  const milisegundos = Date.parse(instante)
  if (!Number.isFinite(milisegundos)) return instante
  return FECHA_HORA.format(milisegundos).replace(',', '')
}

const HOY_EN_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Hoy en Lima como "YYYY-MM-DD" (en-CA ya da ese orden; sin new Date('YYYY-MM-DD')). */
export const hoyIso = (): string => HOY_EN_LIMA.format(Date.now())

/** dd/mm/aaaa → YYYY-MM-DD (null si no tiene ese formato). */
export function fechaAIso(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim())
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : null
}

/** Nombre del mes (1–12) con "Setiembre". */
export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes)
}

/** (2026, 3) → "Marzo 2026". */
export const formatearPeriodo = (anio: number, mes: number) => `${nombreMes(mes)} ${anio}`

/** ("F001", "123") → "F001-0000123". */
export function formatearDocumento(serie: string, numero: string): string {
  return `${serie.trim()}-${numero.trim().padStart(7, '0')}`
}
