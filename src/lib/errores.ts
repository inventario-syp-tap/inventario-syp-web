// Errores de la API ({ codigo, mensaje, detalle }) → mensajes en español de docs/UI-UX.md §6.
import { formatearFecha, formatearToneladas, nombreMes } from './formato'

export type Detalle = Record<string, unknown>

export class ErrorApi extends Error {
  readonly status: number
  readonly codigo: string
  readonly detalle: Detalle | undefined
  readonly requestId: string | undefined

  constructor(status: number, codigo: string, mensaje: string, detalle?: Detalle, requestId?: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.status = status
    this.codigo = codigo
    this.detalle = detalle
    this.requestId = requestId
  }
}

/** Códigos propios del cliente (no vienen de la API). */
export const SIN_RESPUESTA = 'SIN_RESPUESTA'
export const SIN_CONEXION = 'SIN_CONEXION'

type Plantilla = string | ((d: Detalle, e: ErrorApi) => string)

const texto = (d: Detalle, clave: string): string | undefined => {
  const valor = d[clave]
  return typeof valor === 'string' || typeof valor === 'number' ? String(valor) : undefined
}

const MENSAJES: Record<string, Plantilla> = {
  VALIDACION: 'Revisa los campos marcados.',
  NO_AUTENTICADO: 'Tu sesión terminó. Vuelve a ingresar.',
  SIN_PERMISO: 'No tienes permiso para esta acción.',
  NO_ENCONTRADO: 'No encontramos ese registro (quizá fue anulado).',
  PERIODO_CERRADO: (d) => {
    const mes = texto(d, 'mes')
    return `El mes${mes ? ` de ${nombreMes(Number.parseInt(mes, 10)).toLowerCase()}` : ''} está cerrado. Pide reabrirlo si necesitas cambiarlo.`
  },
  PERIODO_ANTERIOR_ABIERTO: 'Primero cierra el mes anterior.',
  PERIODO_POSTERIOR_CERRADO: 'Solo se puede reabrir el último mes cerrado.',
  STOCK_INSUFICIENTE: (d, e) => {
    const fecha = texto(d, 'fecha')
    const disponible = texto(d, 'disponible') ?? texto(d, 'disponibleAntes')
    if (!fecha || !disponible) return e.message || 'No hay stock suficiente.'
    return `No hay stock suficiente al ${formatearFecha(fecha)} (disponible ${formatearToneladas(disponible)} TN).`
  },
  COMPROBANTE_DUPLICADO: 'Ya existe ese comprobante de este tercero.',
  RUC_INVALIDO: 'El RUC no es válido (revisa los 11 dígitos).',
  DOCUMENTO_INVALIDO: 'El documento no tiene el formato correcto.',
  SUSTENTO_REQUERIDO: 'Indica el sustento (informe técnico o acta).',
  PRECIO_VENTA_REQUERIDO: 'Indica el valor de venta sin IGV de cada línea.',
  TIPO_CAMBIO_REQUERIDO: 'Para ventas en dólares indica el tipo de cambio de la fecha de emisión.',
  CIERRE_ANUAL_INCOMPLETO: 'Cierra los 12 meses antes del cierre anual.',
  VIGENCIA_SUPERPUESTA: 'Ya existe una regla vigente en esas fechas para el mismo tipo, producto y operación. Cierra la anterior con "vigente hasta".',
  VIGENCIA_INVALIDA: 'La vigencia no es válida: usa AAAA-MM y que "vigente hasta" no sea anterior a "vigente desde".',
  OPERACION_NO_CORRESPONDE: 'La operación no corresponde al tipo de asiento (costo de ventas: 01 o 17 · merma: 13 · desmedro: 14 · ajustes: 28).',
  PRODUCTO_INEXISTENTE: 'Ese producto no existe o está inactivo.',
  CODIGO_SUNAT_INVALIDO: 'Uno de los códigos SUNAT (Tabla 5, 6 o 14) no es válido.',
  CUENTA_INVALIDA: 'La cuenta contable debe tener de 2 a 12 dígitos.',
  TERCERO_DUPLICADO: 'Ya existe un cliente o proveedor con ese documento.',
  TERCERO_PROTEGIDO: '"CLIENTES VARIOS" no puede cambiar de documento ni de nombre.',
  PRODUCTO_DUPLICADO: 'Ya existe un producto con ese código.',
  ESTABLECIMIENTO_DUPLICADO: 'Ya existe un establecimiento con ese código.',
  COMPROBANTE_ANULADO: 'Ese comprobante está anulado: ya no se puede editar ni mover.',
  REORDEN_FUERA_DE_FECHA: 'Solo se puede mover dentro de la misma fecha.',
  HISTORICO_YA_CARGADO: 'El histórico 2024–2026 ya está cargado en esta base.',
  NO_DISPONIBLE_EN_DEMO: 'No disponible en la base de demostración.',
  REGLA_CONTABLE_FALTANTE: 'Hay movimientos sin regla contable: configúrala en Maestros → Reglas contables.',
  CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.',
  DEMASIADAS_SOLICITUDES: 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.',
  CAMBIO_PASSWORD_REQUERIDO: 'Debes cambiar tu contraseña antes de continuar.',
  ERROR_INTERNO: (_d, e) =>
    `Ocurrió un error inesperado. Intenta de nuevo; si continúa, avisa al administrador${e.requestId ? ` (código ${e.requestId})` : ''}.`,
  [SIN_RESPUESTA]: 'El servidor no respondió a tiempo. Si estabas guardando algo, revisa si se registró antes de repetirlo.',
  [SIN_CONEXION]: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
}

/** Código de la API de un error cualquiera (null si no es ErrorApi). */
export const codigoDeError = (error: unknown): string | null => (error instanceof ErrorApi ? error.codigo : null)

/**
 * Campos marcados por un 400 VALIDACION (`detalle.campos`), para mostrarlos junto a cada campo.
 * El OpenAPI no fija su forma: se acepta `{ campo: "mensaje" | ["mensaje"] }` o `[{ campo, mensaje }]`.
 */
export function camposConError(error: unknown): Record<string, string> {
  if (!(error instanceof ErrorApi) || error.codigo !== 'VALIDACION') return {}
  const campos = error.detalle?.campos
  const resultado: Record<string, string> = {}
  if (Array.isArray(campos)) {
    for (const item of campos) {
      if (item && typeof item === 'object' && 'campo' in item && typeof item.campo === 'string') {
        resultado[item.campo] = 'mensaje' in item && typeof item.mensaje === 'string' ? item.mensaje : 'Revisa este campo.'
      }
    }
  } else if (campos && typeof campos === 'object') {
    for (const [campo, valor] of Object.entries(campos)) {
      const mensaje = Array.isArray(valor) ? valor.find((v) => typeof v === 'string') : valor
      resultado[campo] = typeof mensaje === 'string' ? mensaje : 'Revisa este campo.'
    }
  }
  return resultado
}

/** Mensaje para mostrar al usuario a partir de cualquier error. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) {
    const plantilla = MENSAJES[error.codigo]
    if (typeof plantilla === 'function') return plantilla(error.detalle ?? {}, error)
    if (plantilla) return plantilla
    return error.message || 'Ocurrió un error inesperado. Intenta de nuevo.'
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo.'
}
