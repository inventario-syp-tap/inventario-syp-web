import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { PaginaPeriodos } from './pagina-periodos'
import { accionesPorMes, conSigno, negativo, nombreCampoCierre } from './utilidades'
import { solicitar } from '@/api/cliente'
import { ErrorApi } from '@/lib/errores'
import { reiniciarSesionParaPruebas } from '@/lib/sesion'
import { crearApiFalsa, renderizarEnRuta } from '@/pruebas/api-falsa'
import { alertaDemo, periodoDemo, periodosAnioDemo } from '@/pruebas/periodos-demo'

vi.mock('@/api/cliente', () => ({ solicitar: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/formato', async (original) => ({ ...(await original<typeof import('@/lib/formato')>()), hoyIso: () => '2026-05-10' }))

const api = crearApiFalsa()

beforeEach(() => {
  vi.mocked(solicitar).mockImplementation(api.solicitar)
  // Enero y febrero cerrados; marzo a mayo abiertos; junio en adelante son meses futuros.
  api.en('GET', '/periodos', periodosAnioDemo(2026, [1, 2]))
  api.en('GET', '/kardex/alertas', { anio: 2026, totales: {}, alertas: [alertaDemo()] })
})

afterEach(() => {
  api.reiniciar()
  reiniciarSesionParaPruebas()
  vi.clearAllMocks()
})

const abrir = (roles: string[]) =>
  renderizarEnRuta(<PaginaPeriodos />, { ruta: '/inventario/periodos?anio=2026', patron: '/inventario/periodos', roles })

const tarjeta = (mes: string) => screen.getByRole('group', { name: mes })

describe('Periodos: utilidades', () => {
  it('cerrar solo si el mes anterior no está abierto y no es futuro; reabrir solo el último cerrado', () => {
    const { cerrables, reabrible } = accionesPorMes(periodosAnioDemo(2026, [1, 2]).meses, '2026-05-10')
    expect([...cerrables]).toEqual([3])
    expect(reabrible).toBe(2)
    expect([...accionesPorMes(periodosAnioDemo(2026).meses, '2026-05-10').cerrables]).toEqual([1])
    expect(accionesPorMes(periodosAnioDemo(2026).meses, '2026-05-10').reabrible).toBeNull()
  })

  it('las diferencias del cierre anual llevan signo explícito; el signo se lee del texto', () => {
    expect(conSigno('0.01', 2)).toBe('+0.01')
    expect(conSigno('-2.5', 2)).toBe('-2.50')
    expect(conSigno('0', 4)).toBe('0.0000')
    expect(conSigno('1234.5', 2)).toBe('+1,234.50')
    expect(negativo('-0.0000')).toBe(false)
    expect(negativo('-5')).toBe(true)
  })

  it('los campos del cierre se nombran en español; uno desconocido se muestra tal cual', () => {
    expect(nombreCampoCierre('siCantidad')).toBe('saldo inicial TN')
    expect(nombreCampoCierre('siCosto')).toBe('saldo inicial S/')
    expect(nombreCampoCierre('costoVentas')).toBe('costo de ventas S/')
    expect(nombreCampoCierre('otrasSalidasCosto')).toBe('otras salidas S/')
    expect(nombreCampoCierre('sfCosto')).toBe('saldo final S/')
    expect(nombreCampoCierre('campoNuevo')).toBe('campoNuevo')
    expect(nombreCampoCierre('toString')).toBe('toString')
  })
})

describe('Periodos: tarjetas y permisos', () => {
  it('doce tarjetas: movimientos, TN de compras y ventas, detalle por producto, enlace al libro 12.1 y asiento Pendiente', async () => {
    abrir(['inventario:CONSULTA'])
    // Las tarjetas son grupos con nombre (el detalle por producto es un <details>, que también es un grupo).
    expect((await screen.findAllByRole('group')).filter((g) => g.hasAttribute('aria-labelledby'))).toHaveLength(12)
    const marzo = tarjeta('Marzo')
    expect(within(marzo).getByText('Abierto')).toBeInTheDocument()
    expect(within(marzo).getByText('4 movimientos')).toBeInTheDocument()
    expect(marzo).toHaveTextContent('Compras: 30.0000 TN')
    expect(marzo).toHaveTextContent('Ventas: 25.5000 TN')
    expect(within(marzo).getByText('Por producto')).toBeInTheDocument()
    expect(marzo).toHaveTextContent('INOXIDABLE: 1 movimiento · compras 0.0000 TN · ventas 5.5000 TN')
    expect(within(marzo).getByRole('link', { name: 'Ver libro 12.1 de Marzo 2026' }))
      .toHaveAttribute('href', '/inventario/libros/12-1?anio=2026&mes=3')
    // Libro 12.1 y asiento pendientes.
    expect(within(marzo).getAllByText('Pendiente')).toHaveLength(2)
    expect(within(marzo).queryByText(/Con movimientos/)).not.toBeInTheDocument()
  })

  it('libro 12.1 en sus tres estados: Pendiente, Impreso dd/mm/aaaa y Desactualizado (sin usar libroImpreso)', async () => {
    const base = periodosAnioDemo(2026, [1, 2, 3])
    api.en('GET', '/periodos', {
      ...base,
      meses: base.meses.map((m) => {
        if (m.mes === 1) return { ...m, libro121: { estado: 'IMPRESO', impresoEn: '2026-02-10T15:00:00.000Z' } }
        // libroImpreso (obsoleto) no debe usarse: manda libro121.
        if (m.mes === 2) return { ...m, libro121: { estado: 'DESACTUALIZADO', impresoEn: '2026-03-05T15:00:00.000Z' }, libroImpreso: { impresoEn: '2026-03-05T15:00:00.000Z' } }
        if (m.mes === 3) return { ...m, libroImpreso: { impresoEn: '2026-04-05T15:00:00.000Z' }, movimientos: 1 }
        return m
      }),
    })
    abrir(['inventario:CONSULTA'])
    await screen.findAllByRole('group')
    expect(within(tarjeta('Enero')).getByText('Impreso 10/02/2026')).toBeInTheDocument()
    expect(within(tarjeta('Febrero')).getByText('Desactualizado')).toBeInTheDocument()
    const marzo = tarjeta('Marzo')
    expect(within(marzo).queryByText(/Impreso/)).not.toBeInTheDocument()
    expect(within(marzo).getAllByText('Pendiente')).toHaveLength(2)
    expect(within(marzo).getByText('1 movimiento')).toBeInTheDocument()
  })

  it('asiento real (S11): Sin asiento, Pendiente, Exportado y Desactualizado, con enlace a Asientos del mes', async () => {
    const base = periodosAnioDemo(2026, [1, 2, 3])
    const estados = { 1: 'EXPORTADO', 2: 'DESACTUALIZADO', 3: 'PENDIENTE', 4: 'SIN_ASIENTO' } as const
    api.en('GET', '/periodos', {
      ...base,
      meses: base.meses.map((m) => (m.mes in estados ? { ...m, asiento: { estado: estados[m.mes as keyof typeof estados] } } : m)),
    })
    abrir(['inventario:CONSULTA'])
    await screen.findAllByRole('group')
    const enero = tarjeta('Enero')
    expect(within(enero).getByText('Exportado')).toBeInTheDocument()
    expect(within(enero).getByRole('link', { name: 'Ver asientos de Enero 2026' }))
      .toHaveAttribute('href', '/inventario/asientos?anio=2026&mes=1')
    // Igual que el libro 12.1 en la tarjeta: "Desactualizado" (corto), con ícono.
    expect(within(tarjeta('Febrero')).getByText('Desactualizado')).toBeInTheDocument()
    expect(within(tarjeta('Marzo')).getAllByText('Pendiente')).toHaveLength(2)
    expect(within(tarjeta('Abril')).getByText('Sin asiento')).toBeInTheDocument()
  })

  it('CONSULTA y ASISTENTE no ven Cerrar, Reabrir, Cerrar en bloque ni Cierre anual', async () => {
    for (const rol of ['inventario:CONSULTA', 'inventario:ASISTENTE']) {
      const { unmount } = abrir([rol])
      await screen.findAllByRole('group')
      expect(screen.queryByRole('button', { name: /^(Cerrar|Reabrir) / })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cerrar en bloque' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Cierre anual/ })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('CONTADOR: Cerrar solo en el mes siguiente al último cerrado, Reabrir solo el último cerrado; sin Cerrar en bloque', async () => {
    abrir(['inventario:CONTADOR'])
    await screen.findAllByRole('group')
    expect(screen.getAllByRole('button', { name: /^Cerrar [A-Z]/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Cerrar Marzo 2026'])
    expect(screen.getAllByRole('button', { name: /^Reabrir / }).map((b) => b.getAttribute('aria-label'))).toEqual(['Reabrir Febrero 2026'])
    expect(screen.queryByRole('button', { name: 'Cerrar en bloque' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Cierre anual 2026/ })).toHaveAttribute('href', '/inventario/periodos/cierre-anual?anio=2026')
  })

  it('ADMIN ve Cerrar en bloque', async () => {
    abrir(['inventario:ADMIN'])
    expect(await screen.findByRole('button', { name: 'Cerrar en bloque' })).toBeInTheDocument()
  })

  it('error al cargar: mensaje y Reintentar', async () => {
    api.en('GET', '/periodos', () => { throw new ErrorApi(500, 'ERROR_INTERNO', 'x') })
    abrir(['inventario:CONSULTA'])
    expect(await screen.findByText(/Ocurrió un error inesperado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('Periodos: cerrar', () => {
  it('el diálogo lista los saldos negativos del mes (no bloquean) y, al cerrar, muestra las advertencias de la API', async () => {
    api.en('POST', '/periodos/2026/3/cerrar', {
      periodo: periodoDemo(2026, 3, 'CERRADO'), cierres: [],
      saldosNegativos: [{ productoId: 1, productoCodigo: 'FIERRO', movimientoId: 'mov-2', fecha: '2026-03-20', saldoCantidad: '-5.0000' }],
      diferenciasConCierreAnterior: [],
    })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar Marzo 2026' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Cerrar Marzo 2026' })
    expect(within(dialogo).getByText('Hay 1 saldo negativo en el mes (no impiden el cierre)')).toBeInTheDocument()
    expect(within(dialogo).getByRole('link', { name: /FIERRO · 20\/03\/2026 · E001-0000045/ }))
      .toHaveAttribute('href', '/inventario/kardex?producto=1&anio=2026&mes=3#fila-mov-2')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar Marzo 2026' }))
    await waitFor(() => expect(api.hechas('POST', '/periodos/2026/3/cerrar')).toHaveLength(1))
    expect(toast.success).toHaveBeenCalledWith('Marzo 2026 cerrado')
    const aviso = (await screen.findByText('Marzo 2026 cerrado, con advertencias')).closest('[role="status"]') as HTMLElement
    expect(within(aviso).getByText('Marzo 2026: saldos negativos (no impidieron el cierre)')).toBeInTheDocument()
    expect(within(aviso).getByText('-5.0000')).toHaveClass('text-destructive')
    // El botón «Cerrar mes» ya no existe: el foco pasa al aviso del resultado.
    await waitFor(() => expect(aviso.parentElement).toHaveFocus())
  })

  it('al volver a cerrar, los totales que cambiaron se nombran en español (no con las claves internas)', async () => {
    const dif = (campo: string, anterior: string, nuevo: string, diferencia: string) => ({ productoId: 1, campo, anterior, nuevo, diferencia })
    api.en('POST', '/periodos/2026/3/cerrar', {
      periodo: periodoDemo(2026, 3, 'CERRADO'), cierres: [], saldosNegativos: [],
      diferenciasConCierreAnterior: [
        dif('comprasCantidad', '10.0000', '12.0000', '2.0000'), dif('comprasCosto', '1000.00', '1200.00', '200.00'),
        dif('sfCantidad', '5.0000', '7.0000', '2.0000'), dif('sfCosto', '500.00', '700.00', '200.00'),
      ],
    })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar Marzo 2026' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Cerrar Marzo 2026' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar Marzo 2026' }))
    const aviso = (await screen.findByText('Marzo 2026 cerrado, con advertencias')).closest('[role="status"]') as HTMLElement
    expect(aviso).toHaveTextContent(
      'Marzo 2026: 4 totales cambiaron respecto del cierre anterior (compras TN, compras S/, saldo final TN, saldo final S/).')
    expect(aviso).not.toHaveTextContent(/comprasCantidad|comprasCosto|sfCantidad|sfCosto/)
  })

  it('CIERRE_CON_SALDO_CERO_CON_COSTO: el diálogo sigue abierto y lista los movimientos con enlace al kardex', async () => {
    api.en('POST', '/periodos/2026/3/cerrar', () => {
      throw new ErrorApi(409, 'CIERRE_CON_SALDO_CERO_CON_COSTO', 'x', {
        periodo: '2026-03',
        movimientos: [{ movimientoId: 'mov-9', productoId: 2, productoCodigo: 'INOXIDABLE', fecha: '2026-03-28', orden: 4, saldoCosto: '0.0000000001' }],
      })
    })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar Marzo 2026' }))
    const dialogo = await screen.findByRole('alertdialog', { name: 'Cerrar Marzo 2026' })
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar Marzo 2026' }))
    expect(await within(dialogo).findByText(
      'No se puede cerrar marzo de 2026: hay movimientos con saldo cero y costo. Revísalos en el kardex (lista abajo).')).toBeInTheDocument()
    expect(within(dialogo).getByText('Saldo cero con costo')).toBeInTheDocument()
    expect(within(dialogo).getByRole('link', { name: /INOXIDABLE · 28\/03\/2026/ }))
      .toHaveAttribute('href', '/inventario/kardex?producto=2&anio=2026&mes=3#fila-mov-9')
  })

  it('PERIODO_FUTURO y PERIODO_ANTERIOR_AL_INICIO con mensajes claros', async () => {
    for (const [codigo, mensaje] of [
      ['PERIODO_FUTURO', 'Ese mes aún no llega: no se puede cerrar un mes posterior al mes en curso.'],
      ['PERIODO_ANTERIOR_AL_INICIO', 'Ese mes es anterior al primer periodo registrado en el sistema: no hay nada que cerrar.'],
    ] as const) {
      api.en('POST', '/periodos/2026/3/cerrar', () => { throw new ErrorApi(422, codigo, 'x') })
      const { unmount } = abrir(['inventario:CONTADOR'])
      await userEvent.click(await screen.findByRole('button', { name: 'Cerrar Marzo 2026' }))
      const dialogo = await screen.findByRole('alertdialog')
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar Marzo 2026' }))
      expect(await within(dialogo).findByText(mensaje)).toBeInTheDocument()
      unmount()
    }
  })

  it('CONFLICTO_CONCURRENTE al cerrar: "Reintentar" vuelve a cargar los periodos sin reenviar', async () => {
    api.en('POST', '/periodos/2026/3/cerrar', () => { throw new ErrorApi(409, 'CONFLICTO_CONCURRENTE', 'x') })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar Marzo 2026' }))
    const dialogo = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar Marzo 2026' }))
    expect(await within(dialogo).findByText('Otro usuario modificó estos datos al mismo tiempo.')).toBeInTheDocument()
    const cargas = api.hechas('GET', '/periodos').length
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.hechas('GET', '/periodos').length).toBeGreaterThan(cargas))
    expect(api.hechas('POST', '/periodos/2026/3/cerrar')).toHaveLength(1)
  })
})

describe('Periodos: reabrir y cerrar en bloque', () => {
  it('reabrir exige motivo (zod) y lo envía; muestra las advertencias de la API', async () => {
    api.en('POST', '/periodos/2026/2/reabrir', {
      periodo: periodoDemo(2026, 2), advertencias: ['El libro 12.1 de 2026-02 ya se registró como impreso.'],
    })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Reabrir Febrero 2026' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Reabrir Febrero 2026' })
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), '   ')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Reabrir/ }))
    expect(await within(dialogo).findByText('Escribe el motivo de la reapertura.')).toBeInTheDocument()
    expect(api.hechas('POST', '/periodos/2026/2/reabrir')).toHaveLength(0)
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Corrección de una factura demo')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Reabrir/ }))
    await waitFor(() => expect(api.hechas('POST', '/periodos/2026/2/reabrir')[0]?.cuerpo).toEqual({ motivo: 'Corrección de una factura demo' }))
    expect(toast.success).toHaveBeenCalledWith('Febrero 2026 reabierto', expect.objectContaining({
      description: 'El libro 12.1 de 2026-02 ya se registró como impreso.',
    }))
  })

  it('PERIODO_NO_CERRADO al reabrir: mensaje claro', async () => {
    api.en('POST', '/periodos/2026/2/reabrir', () => { throw new ErrorApi(409, 'PERIODO_NO_CERRADO', 'x') })
    abrir(['inventario:CONTADOR'])
    await userEvent.click(await screen.findByRole('button', { name: 'Reabrir Febrero 2026' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Motivo'), 'Motivo demo')
    await userEvent.click(within(dialogo).getByRole('button', { name: /^Reabrir/ }))
    expect(await within(dialogo).findByText('Ese mes no está cerrado: no hay nada que reabrir.')).toBeInTheDocument()
  })

  it('ADMIN cierra en bloque con confirmación del rango', async () => {
    api.en('POST', '/periodos/cerrar-en-bloque', {
      cierres: [3, 4].map((mes) => ({ periodo: periodoDemo(2026, mes, 'CERRADO'), cierres: [], saldosNegativos: [], diferenciasConCierreAnterior: [] })),
    })
    abrir(['inventario:ADMIN'])
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar en bloque' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cerrar en bloque' })
    const hasta = within(dialogo).getByLabelText('Hasta (inclusive)')
    await userEvent.clear(hasta)
    await userEvent.type(hasta, '2026-04')
    await userEvent.click(within(dialogo).getByRole('button', { name: /Cerrar meses/ }))
    const confirmar = await screen.findByRole('alertdialog', { name: '¿Cerrar todos esos meses?' })
    expect(confirmar).toHaveAccessibleDescription(expect.stringContaining('desde Enero 2026 hasta Abril 2026'))
    await userEvent.click(within(confirmar).getByRole('button', { name: 'Sí, cerrar' }))
    await waitFor(() => expect(api.hechas('POST', '/periodos/cerrar-en-bloque')[0]?.cuerpo).toEqual({ desde: '2026-01', hasta: '2026-04' }))
    expect(toast.success).toHaveBeenCalledWith('Se cerraron 2 meses')
  })
})
