import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TablaDatos, type ColumnaTabla } from './tabla-datos'

type Fila = { id: number; codigo: string; descripcion: string; cantidad: string }

// Solo datos de demostración (docs/UI-UX.md §10).
const filas: Fila[] = [
  { id: 1, codigo: 'D-FIERRO', descripcion: 'CHATARRA DE FIERRO', cantidad: '10.0000' },
  { id: 2, codigo: 'D-INOX', descripcion: 'CHATARRA INOXIDABLE', cantidad: '2.5000' },
  { id: 3, codigo: 'D-COBRE', descripcion: 'CHATARRA DE COBRE', cantidad: '100.0000' },
]

const columnas: ColumnaTabla<Fila>[] = [
  { id: 'codigo', encabezado: 'Código', valor: (f) => f.codigo },
  { id: 'descripcion', encabezado: 'Descripción', valor: (f) => f.descripcion },
  { id: 'cantidad', encabezado: 'Cantidad', numerica: true, ordenable: false, celda: (f) => f.cantidad },
]

const codigosVisibles = () =>
  screen.getAllByRole('row').slice(1).map((fila) => within(fila).getAllByRole('cell')[0].textContent)

describe('TablaDatos', () => {
  it('tiene caption, encabezados con scope y la columna numérica a la derecha', () => {
    render(<TablaDatos titulo="Productos de prueba" columnas={columnas} datos={filas} idFila={(f) => String(f.id)} />)
    const tabla = screen.getByRole('table', { name: 'Productos de prueba' })
    expect(within(tabla).getByRole('columnheader', { name: 'Cantidad' })).toHaveAttribute('scope', 'col')
    expect(within(tabla).getByText('100.0000').closest('td')).toHaveClass('text-right', 'tabular-nums')
  })

  it('ordena con el botón del encabezado y lo anuncia con aria-sort', async () => {
    render(<TablaDatos titulo="Productos" columnas={columnas} datos={filas} idFila={(f) => String(f.id)} />)
    const encabezado = screen.getByRole('columnheader', { name: /Código/ })
    expect(encabezado).toHaveAttribute('aria-sort', 'none')
    await userEvent.click(within(encabezado).getByRole('button'))
    expect(encabezado).toHaveAttribute('aria-sort', 'ascending')
    expect(codigosVisibles()).toEqual(['D-COBRE', 'D-FIERRO', 'D-INOX'])
    await userEvent.click(within(encabezado).getByRole('button'))
    expect(encabezado).toHaveAttribute('aria-sort', 'descending')
    expect(codigosVisibles()).toEqual(['D-INOX', 'D-FIERRO', 'D-COBRE'])
    // La columna sin orden no lleva aria-sort ni botón
    const cantidad = screen.getByRole('columnheader', { name: 'Cantidad' })
    expect(cantidad).not.toHaveAttribute('aria-sort')
  })

  it('el orden también se cambia con el teclado', async () => {
    render(<TablaDatos titulo="Productos" columnas={columnas} datos={filas} idFila={(f) => String(f.id)} />)
    const boton = within(screen.getByRole('columnheader', { name: /Descripción/ })).getByRole('button')
    boton.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('columnheader', { name: /Descripción/ })).toHaveAttribute('aria-sort', 'ascending')
  })

  it('busca sin distinguir mayúsculas ni tildes y "/" enfoca el buscador', async () => {
    render(<TablaDatos titulo="Productos" columnas={columnas} datos={filas} idFila={(f) => String(f.id)} ayudaBusqueda="Código o descripción" />)
    await userEvent.keyboard('/')
    const buscador = screen.getByRole('searchbox', { name: 'Buscar' })
    expect(buscador).toHaveFocus()
    await userEvent.type(buscador, 'inoxidáble')
    expect(codigosVisibles()).toEqual(['D-INOX'])
    await userEvent.clear(buscador)
    await userEvent.type(buscador, 'plomo')
    expect(screen.getByText('No hay resultados para «plomo».')).toBeInTheDocument()
  })

  it('pagina en el cliente', async () => {
    render(<TablaDatos titulo="Productos" columnas={columnas} datos={filas} idFila={(f) => String(f.id)} filasPorPagina={2} />)
    expect(screen.getByText('Página 1 de 2 · 3 registros')).toBeInTheDocument()
    expect(codigosVisibles()).toEqual(['D-FIERRO', 'D-INOX'])
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(codigosVisibles()).toEqual(['D-COBRE'])
  })

  it('con paginación del servidor avisa la página pedida y no ordena localmente', async () => {
    const alCambiarPagina = vi.fn()
    render(
      <TablaDatos titulo="Terceros" columnas={columnas} datos={filas} idFila={(f) => String(f.id)}
        paginacionServidor={{ pagina: 1, tamano: 3, total: 7, alCambiarPagina }} />,
    )
    expect(screen.getByText('Página 1 de 3 · 7 registros')).toBeInTheDocument()
    expect(within(screen.getByRole('columnheader', { name: 'Código' })).queryByRole('button')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(alCambiarPagina).toHaveBeenCalledWith(2)
  })

  it('muestra el estado vacío y el esqueleto de carga', () => {
    const { rerender } = render(<TablaDatos titulo="Productos" columnas={columnas} datos={undefined} idFila={(f) => String(f.id)} cargando />)
    expect(screen.queryByText('Aún no hay productos.')).not.toBeInTheDocument()
    rerender(<TablaDatos titulo="Productos" columnas={columnas} datos={[]} idFila={(f) => String(f.id)} vacio="Aún no hay productos." />)
    expect(screen.getByText('Aún no hay productos.')).toBeInTheDocument()
  })
})
