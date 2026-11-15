// Saldos iniciales por año y producto (docs/CONTRATO-API.md §6.4). Ver: todos · editar un saldo manual: A, C
// (motivo obligatorio). Solo se editan los que existen: la API aún no tiene un alta manual (pendiente S10).
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'
import { consultaUrl } from './terceros'

export type SaldoInicial = components['schemas']['SaldoInicialDto']
export type OrigenSaldoInicial = SaldoInicial['origen']
export type DatosEditarSaldoInicial = components['schemas']['EditarSaldoInicialDto']

export const listarSaldosIniciales = (anio: number) => solicitar<SaldoInicial[]>(`/saldos-iniciales${consultaUrl({ anio })}`)

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
