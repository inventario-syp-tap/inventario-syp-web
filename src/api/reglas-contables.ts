// Reglas contables (docs/CONTRATO-API.md §6.2). Ver: todos · crear y editar: ADMIN y CONTADOR.
// Tipo, producto, operación y cuentas se fijan al crear; al editar solo vigenteHasta, decisión y descripción.
import { useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'

export type ReglaContable = components['schemas']['ReglaContableDto']
export type DatosCrearRegla = components['schemas']['CrearReglaContableDto']
export type DatosEditarRegla = components['schemas']['EditarReglaContableDto']
export type TipoAsiento = ReglaContable['tipoAsiento']

export const listarReglas = () => solicitar<ReglaContable[]>('/reglas-contables')

export const crearRegla = (datos: DatosCrearRegla) =>
  solicitar<ReglaContable>('/reglas-contables', { metodo: 'POST', cuerpo: datos })

export const editarRegla = (id: number, datos: DatosEditarRegla) =>
  solicitar<ReglaContable>(`/reglas-contables/${id}`, { metodo: 'PATCH', cuerpo: datos })

export function useReglas() {
  return useQuery({ queryKey: CLAVES.reglas, queryFn: listarReglas })
}
