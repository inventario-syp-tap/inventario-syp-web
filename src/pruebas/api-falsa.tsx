// Doble de la API para pruebas de pantallas: reemplaza `solicitar` de api/cliente.ts (vi.mock) y responde por
// "MÉTODO /ruta". Así se prueban los hooks reales de TanStack Query. Solo datos de demostración (docs/UI-UX.md §10).
import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Metodo, OpcionesSolicitud } from '@/api/cliente'
import { establecerSesion } from '@/lib/sesion'
import { usuarioDemo } from './falsos'

type Manejador = (llamada: Llamada) => unknown

export type Llamada = { metodo: Metodo; ruta: string; cuerpo: unknown }

export function crearApiFalsa() {
  const rutas = new Map<string, Manejador>()
  const llamadas: Llamada[] = []

  async function solicitar<T>(ruta: string, opciones: OpcionesSolicitud = {}): Promise<T> {
    const metodo = opciones.metodo ?? 'GET'
    const llamada = { metodo, ruta, cuerpo: opciones.cuerpo }
    llamadas.push(llamada)
    const manejador = rutas.get(`${metodo} ${ruta}`) ?? rutas.get(`${metodo} ${ruta.split('?')[0]}`)
    if (!manejador) throw new Error(`Sin respuesta simulada para ${metodo} ${ruta}`)
    return (await manejador(llamada)) as T
  }

  return {
    solicitar,
    llamadas,
    /** Responde siempre lo mismo (o lo que devuelva la función; si lanza, la llamada falla). */
    en(metodo: Metodo, ruta: string, respuesta: unknown) {
      rutas.set(`${metodo} ${ruta}`, typeof respuesta === 'function' ? (respuesta as Manejador) : () => respuesta)
    },
    /** Llamadas hechas a un método y ruta (sin la consulta). */
    hechas(metodo: Metodo, ruta: string) {
      return llamadas.filter((l) => l.metodo === metodo && l.ruta.split('?')[0] === ruta)
    },
    reiniciar() {
      rutas.clear()
      llamadas.length = 0
    },
  }
}

/** Monta una pantalla con sesión de los roles indicados (con prefijo: "inventario:CONTADOR"). */
export function renderizarConSesion(ui: ReactNode, roles: string[] = ['inventario:CONTADOR']) {
  establecerSesion('token-de-prueba', usuarioDemo(roles))
  const clienteConsultas = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={clienteConsultas}>{ui}</QueryClientProvider>)
}

/** Catálogos mínimos (Tablas SUNAT) para los selects. */
export const catalogosDemo = {
  tiposDocumentoIdentidad: [
    { codigo: '0', descripcion: 'OTROS' }, { codigo: '1', descripcion: 'DNI' }, { codigo: '6', descripcion: 'RUC' },
  ],
  tiposExistencia: [{ codigo: '01', descripcion: 'MERCADERÍAS' }],
  unidadesMedida: [{ codigo: 'TNE', descripcion: 'TONELADAS', nota: null }],
  tiposComprobante: [],
  tiposOperacion: [
    { codigo: '01', descripcion: 'VENTA NACIONAL', movimiento: 'SALIDA', habilitado: true },
    { codigo: '17', descripcion: 'EXPORTACIÓN', movimiento: 'SALIDA', habilitado: true },
    { codigo: '13', descripcion: 'MERMAS', movimiento: 'SALIDA', habilitado: true },
  ],
  metodosValuacion: [{ codigo: '1', descripcion: 'PROMEDIO PONDERADO' }, { codigo: '2', descripcion: 'PEPS' }],
}
