// Textos de la pantalla Asientos que dependen de un código de la API (sin componentes).
import type { Asiento } from '@/api/asientos'
import { mensajeDeDescarga } from '@/lib/descargas'
import { codigoDeError } from '@/lib/errores'

/** Motivo por el que la API no deja exportar un tipo de asiento (motivoNoExportable). */
export function textoMotivoNoExportable(motivo: Asiento['motivoNoExportable'], periodo: string): string | null {
  switch (motivo) {
    case 'PERIODO_NO_CERRADO':
      return `${periodo} no está cerrado: esto es una vista previa. El asiento se exporta a WinConta después de cerrar el mes en Periodos.`
    case 'REGLA_CONTABLE_FALTANTE':
      return 'Hay movimientos sin regla contable vigente (lista abajo): no se puede exportar este tipo hasta configurarla.'
    case 'ASIENTO_VACIO':
      return 'No hay movimientos de este tipo en el mes: no hay nada que exportar.'
    default:
      return null
  }
}

/** Mensajes de la exportación a WinConta (además de los generales de las descargas: 403, 429…). */
export function mensajeDeExportacion(error: unknown): string {
  switch (codigoDeError(error)) {
    case 'PERIODO_NO_CERRADO':
      return 'Ese mes aún no está cerrado: el asiento se exporta a WinConta después de cerrarlo en Periodos.'
    case 'REGLA_CONTABLE_FALTANTE':
      return 'Hay movimientos de este tipo sin regla contable vigente: configúrala en Maestros → Reglas contables y vuelve a exportar.'
    case 'ASIENTO_VACIO':
      return 'Este asiento no tiene líneas en el mes: no hay nada que exportar.'
    default:
      return mensajeDeDescarga(error)
  }
}
