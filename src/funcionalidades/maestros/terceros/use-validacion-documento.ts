// Validación del documento en vivo (docs/UI-UX.md §5.16): 400 ms después de escribir, la API revisa el dígito
// verificador del RUC (módulo 11) o el DNI y avisa si ya existe.
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { documentoCompleto } from './esquemas'
import { CLAVES } from '@/api/claves'
import { validarDocumento, type DocumentoValidado, type TipoDocumento } from '@/api/terceros'
import { ErrorApi, mensajeDeError } from '@/lib/errores'

export const ESPERA_VALIDACION_MS = 400

export function useValidacionDocumento(tipo: TipoDocumento, numero: string) {
  const [diferido, setDiferido] = useState(numero.trim())
  useEffect(() => {
    const temporizador = setTimeout(() => setDiferido(numero.trim()), ESPERA_VALIDACION_MS)
    return () => clearTimeout(temporizador)
  }, [numero])

  const listo = diferido === numero.trim()
  const consulta = useQuery({
    queryKey: [...CLAVES.terceros, 'validar-documento', tipo, diferido],
    queryFn: ({ signal }) => validarDocumento(tipo, diferido, signal),
    enabled: documentoCompleto(tipo, diferido),
    staleTime: 30_000,
    retry: false,
  })
  return { ...consulta, listo: listo && documentoCompleto(tipo, diferido) }
}

/** Mensaje en español de un documento no válido (RUC_INVALIDO / DOCUMENTO_INVALIDO de docs/UI-UX.md §6). */
export function mensajeDocumentoInvalido(resultado: DocumentoValidado): string {
  return mensajeDeError(new ErrorApi(422, resultado.codigo ?? 'DOCUMENTO_INVALIDO', resultado.mensaje ?? ''))
}
