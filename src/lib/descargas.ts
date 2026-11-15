// Descargas de archivos de la API (PDF y Excel; docs/UI-UX.md §4 BotonDescarga). El nombre lo decide la API con
// Content-Disposition; aquí solo se lee, se limpia y se guarda el blob. Mensajes propios de las descargas para
// 403 SIN_PERMISO, 409 PERIODO_NO_CERRADO y 429 (límite de descargas por minuto).
import { codigoDeError, ErrorApi, mensajeDeError } from './errores'

/** Quita lo que un sistema de archivos no acepta (rutas, comillas, caracteres de control). */
function limpiarNombre(nombre: string): string | null {
  const limpio = nombre
    .replace(/[\\/:*?"<>|]/g, '_')
    .split('')
    .filter((caracter) => caracter.charCodeAt(0) >= 32)
    .join('')
    .trim()
  return limpio && limpio !== '.' && limpio !== '..' ? limpio : null
}

/**
 * Nombre del archivo de un encabezado Content-Disposition (RFC 6266): prefiere `filename*=UTF-8''…` (codificado)
 * y, si no viene, `filename="…"` o `filename=…`. null si no trae nombre.
 */
export function nombreDeContentDisposition(valor: string | null | undefined): string | null {
  if (!valor) return null
  const extendido = /filename\*\s*=\s*([^;]+)/i.exec(valor)
  if (extendido) {
    const partes = /^([\w-]*)'[^']*'(.*)$/.exec(extendido[1].trim().replace(/^"|"$/g, ''))
    if (partes) {
      try {
        const nombre = limpiarNombre(decodeURIComponent(partes[2]))
        if (nombre) return nombre
      } catch {
        // codificación inválida: se intenta con filename=
      }
    }
  }
  const simple = /filename\s*=\s*("((?:[^"\\]|\\.)*)"|[^;]+)/i.exec(valor)
  if (!simple) return null
  const nombre = simple[2] !== undefined ? simple[2].replace(/\\(.)/g, '$1') : simple[1].trim()
  return limpiarNombre(nombre)
}

/** Guarda el blob como archivo con un enlace temporal (no abre pestañas ni usa servicios externos). */
export function guardarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.rel = 'noopener'
  enlace.style.display = 'none'
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  // Se libera después: algunos navegadores aún leen la URL justo después del clic.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const MENSAJE_LIMITE_DESCARGAS = 'Llegaste al límite de descargas por minuto. Espera un momento y vuelve a intentarlo.'

/** Mensaje claro cuando una descarga falla. */
export function mensajeDeDescarga(error: unknown): string {
  const codigo = codigoDeError(error)
  if (error instanceof ErrorApi && (error.status === 429 || codigo === 'DEMASIADAS_SOLICITUDES')) return MENSAJE_LIMITE_DESCARGAS
  if (codigo === 'SIN_PERMISO') return 'No tienes permiso para descargar este archivo.'
  if (codigo === 'PERIODO_NO_CERRADO') return 'Ese mes aún no está cerrado: el archivo se genera después de cerrarlo en Periodos.'
  return mensajeDeError(error)
}
