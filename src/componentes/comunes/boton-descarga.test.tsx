import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { BotonDescarga } from './boton-descarga'
import { descargarArchivo } from '@/api/descargas'
import { solicitarArchivo } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { guardarArchivo } from '@/lib/descargas'

vi.mock('@/api/cliente', () => ({ solicitarArchivo: vi.fn() }))
vi.mock('@/lib/descargas', async (original) => ({ ...(await original<typeof import('@/lib/descargas')>()), guardarArchivo: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

const boton = () =>
  render(<BotonDescarga ruta="/libros/12-1?anio=2026&mes=1&formato=pdf" nombrePorDefecto="libro.pdf">Descargar PDF</BotonDescarga>)

describe('helper de descargas (descargarArchivo)', () => {
  it('guarda el archivo con el nombre de Content-Disposition; sin encabezado usa el nombre por defecto', async () => {
    const blob = new Blob(['%PDF'])
    vi.mocked(solicitarArchivo).mockResolvedValueOnce({ blob, contentDisposition: 'attachment; filename="libro-12-1-2026-01.pdf"', tipo: 'application/pdf' })
    expect(await descargarArchivo('/libros/12-1?anio=2026', 'libro.pdf')).toBe('libro-12-1-2026-01.pdf')
    expect(guardarArchivo).toHaveBeenCalledWith(blob, 'libro-12-1-2026-01.pdf')
    vi.mocked(solicitarArchivo).mockResolvedValueOnce({ blob, contentDisposition: null, tipo: null })
    expect(await descargarArchivo('/libros/12-1?anio=2026', 'libro.pdf')).toBe('libro.pdf')
  })
})

describe('BotonDescarga', () => {
  it('el nombre accesible con aria-label también anuncia "Generando…"', async () => {
    vi.mocked(solicitarArchivo).mockReturnValueOnce(new Promise(() => {}))
    render(<BotonDescarga ruta="/reportes/margen?anio=2026&formato=xlsx" nombrePorDefecto="margen.xlsx" aria-label="Descargar Excel de Margen 2026">Descargar Excel</BotonDescarga>)
    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel de Margen 2026' }))
    expect(screen.getByRole('button', { name: 'Generando… Descargar Excel de Margen 2026' })).toHaveAttribute('aria-busy', 'true')
  })

  it('muestra "Generando…" mientras la API arma el archivo y avisa al terminar', async () => {
    let terminar: (valor: Awaited<ReturnType<typeof solicitarArchivo>>) => void = () => {}
    vi.mocked(solicitarArchivo).mockReturnValueOnce(new Promise((resolver) => { terminar = resolver }))
    boton()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    const generando = screen.getByRole('button', { name: 'Generando…' })
    expect(generando).toHaveAttribute('aria-busy', 'true')
    expect(generando).toHaveAttribute('aria-disabled', 'true')
    // Un segundo clic mientras genera no pide otro archivo.
    await userEvent.click(generando)
    expect(solicitarArchivo).toHaveBeenCalledTimes(1)
    expect(solicitarArchivo).toHaveBeenCalledWith('/libros/12-1?anio=2026&mes=1&formato=pdf')
    terminar({ blob: new Blob(['%PDF']), contentDisposition: 'attachment; filename="libro-12-1-2026-01.pdf"', tipo: 'application/pdf' })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Descarga lista: libro-12-1-2026-01.pdf'))
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).not.toHaveAttribute('aria-busy')
  })

  it.each([
    [new ErrorApi(403, 'SIN_PERMISO', 'x'), 'No tienes permiso para descargar este archivo.'],
    [new ErrorApi(409, 'PERIODO_NO_CERRADO', 'x'), 'Ese mes aún no está cerrado: el archivo se genera después de cerrarlo en Periodos.'],
    [new ErrorApi(429, 'DEMASIADAS_SOLICITUDES', ''), 'Llegaste al límite de descargas por minuto. Espera un momento y vuelve a intentarlo.'],
  ])('error %#: mensaje claro que no se cierra solo', async (error, mensaje) => {
    vi.mocked(solicitarArchivo).mockRejectedValueOnce(error)
    boton()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(mensaje, { duration: Infinity }))
    expect(guardarArchivo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument()
  })
})
