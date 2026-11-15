import { afterEach, describe, expect, it, vi } from 'vitest'
import { guardarArchivo, MENSAJE_LIMITE_DESCARGAS, mensajeDeDescarga, nombreDeContentDisposition } from './descargas'
import { ErrorApi } from './errores'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('descargas: nombre de Content-Disposition', () => {
  it.each([
    ['attachment; filename="libro-12-1-2026-01.pdf"', 'libro-12-1-2026-01.pdf'],
    ['attachment; filename=reporte-toneladas-2026.xlsx', 'reporte-toneladas-2026.xlsx'],
    // filename* (RFC 5987) manda sobre filename y se decodifica.
    [`attachment; filename="respaldo.pdf"; filename*=UTF-8''libro%2013.1%20a%C3%B1o.pdf`, 'libro 13.1 año.pdf'],
    ['attachment; filename="..\\\\..\\\\carpeta/otro.pdf"', '.._.._carpeta_otro.pdf'],
  ])('%s → %s', (encabezado, esperado) => {
    expect(nombreDeContentDisposition(encabezado)).toBe(esperado)
  })

  it('sin encabezado o sin nombre: null (se usa el nombre por defecto)', () => {
    expect(nombreDeContentDisposition(null)).toBeNull()
    expect(nombreDeContentDisposition('inline')).toBeNull()
  })
})

describe('descargas: mensajes de error', () => {
  it('403 SIN_PERMISO, 409 PERIODO_NO_CERRADO y 429 tienen su mensaje propio', () => {
    expect(mensajeDeDescarga(new ErrorApi(403, 'SIN_PERMISO', 'x'))).toBe('No tienes permiso para descargar este archivo.')
    expect(mensajeDeDescarga(new ErrorApi(409, 'PERIODO_NO_CERRADO', 'x')))
      .toBe('Ese mes aún no está cerrado: el archivo se genera después de cerrarlo en Periodos.')
    expect(mensajeDeDescarga(new ErrorApi(429, 'DEMASIADAS_SOLICITUDES', ''))).toBe(MENSAJE_LIMITE_DESCARGAS)
    // 429 aunque la API mande otro código.
    expect(mensajeDeDescarga(new ErrorApi(429, 'LIMITE_DESCARGAS', ''))).toContain('Espera un momento y vuelve a intentarlo')
    expect(mensajeDeDescarga(new ErrorApi(404, 'NO_ENCONTRADO', 'x'))).toBe('No encontramos ese registro (quizá fue anulado).')
  })
})

describe('descargas: guardar el archivo', () => {
  it('crea un enlace con download = nombre, lo pulsa y libera la URL después', () => {
    vi.useFakeTimers()
    const crear = vi.fn(() => 'blob:demo')
    const liberar = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL: crear, revokeObjectURL: liberar })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    guardarArchivo(new Blob(['%PDF']), 'libro-12-1-2026-01.pdf')
    expect(clic).toHaveBeenCalledTimes(1)
    const enlace = clic.mock.contexts[0] as HTMLAnchorElement
    expect(enlace.download).toBe('libro-12-1-2026-01.pdf')
    expect(enlace.href).toBe('blob:demo')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(liberar).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(liberar).toHaveBeenCalledWith('blob:demo')
    vi.useRealTimers()
  })
})
