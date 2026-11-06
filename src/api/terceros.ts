// Clientes y proveedores (docs/CONTRATO-API.md §6.2). Ver: todos · crear y editar: ADMIN, CONTADOR y ASISTENTE.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CLAVES } from './claves'
import { solicitar } from './cliente'
import type { components } from './esquema'

export type Tercero = components['schemas']['TerceroDto']
export type PaginaTerceros = components['schemas']['TercerosPaginaDto']
export type DatosCrearTercero = components['schemas']['CrearTerceroDto']
export type DatosEditarTercero = components['schemas']['EditarTerceroDto']
export type DocumentoValidado = components['schemas']['DocumentoValidadoDto']
export type TipoDocumento = DatosCrearTercero['tipoDocumento']
export type RolTercero = 'PROVEEDOR' | 'CLIENTE'

export type FiltrosTerceros = { q?: string; rol?: RolTercero; pagina?: number; tamano?: number }

/** Arma "?a=1&b=2" omitiendo los vacíos. */
export function consultaUrl(parametros: Record<string, string | number | undefined>): string {
  const pares: [string, string][] = []
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== '') pares.push([clave, String(valor)])
  }
  const texto = new URLSearchParams(pares).toString()
  return texto ? `?${texto}` : ''
}

export const listarTerceros = ({ q, rol, pagina = 1, tamano = 50 }: FiltrosTerceros = {}) =>
  solicitar<PaginaTerceros>(`/terceros${consultaUrl({ q: q?.trim(), rol, pagina, tamano })}`)

/** Valida formato y dígito verificador (RUC módulo 11, DNI de 8 dígitos) e indica si ya existe. */
export const validarDocumento = (tipo: TipoDocumento, numero: string, senal?: AbortSignal) =>
  solicitar<DocumentoValidado>(`/terceros/validar-documento${consultaUrl({ tipo, numero })}`, { senal })

export const crearTercero = (datos: DatosCrearTercero) =>
  solicitar<Tercero>('/terceros', { metodo: 'POST', cuerpo: datos })

export const editarTercero = (id: number, datos: DatosEditarTercero) =>
  solicitar<Tercero>(`/terceros/${id}`, { metodo: 'PATCH', cuerpo: datos })

export function useTerceros(filtros: FiltrosTerceros, habilitado = true) {
  return useQuery({
    queryKey: [...CLAVES.terceros, filtros],
    queryFn: () => listarTerceros(filtros),
    placeholderData: keepPreviousData,
    enabled: habilitado,
  })
}
