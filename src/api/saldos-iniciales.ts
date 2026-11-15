// Saldos iniciales por año y producto (docs/CONTRATO-API.md §6.4). Ver: todos · crear o editar un saldo manual: A, C
// (motivo obligatorio). Crear solo para un producto y año sin saldo (si ya existe: 409 SALDO_INICIAL_YA_EXISTE).
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type SaldoInicial = components['schemas']['SaldoInicialDto']
export type OrigenSaldoInicial = SaldoInicial['origen']
export type DatosEditarSaldoInicial = components['schemas']['EditarSaldoInicialDto']
export type DatosCrearSaldoInicial = components['schemas']['CrearSaldoInicialDto']

export const listarSaldosIniciales = (anio: number) => solicitar<SaldoInicial[]>(`/saldos-iniciales${consultaUrl({ anio })}`)

export const crearSaldoInicial = (datos: DatosCrearSaldoInicial) =>
  solicitar<SaldoInicial>('/saldos-iniciales', { metodo: 'POST', cuerpo: datos })

export const editarSaldoInicial = (id: number, datos: DatosEditarSaldoInicial) =>
  solicitar<SaldoInicial>(`/saldos-iniciales/${id}`, { metodo: 'PUT', cuerpo: datos })

export function useSaldosIniciales(anio: number) {
  return useQuery({ queryKey: [...CLAVES.saldosIniciales, anio], queryFn: () => listarSaldosIniciales(anio) })
}

export const NOMBRE_ORIGEN: Record<OrigenSaldoInicial, string> = {
  IMPORTACION: 'Importación',
  CIERRE_ANUAL: 'Cierre anual',
  MANUAL: 'Manual',
}
