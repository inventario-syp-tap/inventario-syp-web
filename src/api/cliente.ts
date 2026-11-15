// Cliente HTTP único hacia la API (docs/CONTRATO-API.md §3 y §4). Toda llamada pasa por aquí.
//  - Access token SOLO en memoria (lib/sesion.ts); el refresh es una cookie HttpOnly que maneja el navegador.
//  - 401 → un solo refresh a la vez (single-flight en la pestaña + candado entre pestañas) y UN reintento.
//  - 403 CAMBIO_PASSWORD_REQUERIDO → a /cambiar-password, sin refresh ni reintento.
//  - 502/503/504 o tiempo agotado → "Despertando el servidor…" con esperas crecientes hasta ~90 s.
//  - Operaciones largas (importación): tiempo propio por intento y el 502 del proxy cuenta como "quizá llegó".
import { crearCoordinador, type Coordinador } from './coordinacion-pestanas'
import { empezarDespertar, terminarDespertar } from './estado-servidor'
import type { components } from './esquema'
import { ErrorApi, SIN_CONEXION, SIN_RESPUESTA, type Detalle } from '@/lib/errores'
import {
  establecerSesion,
  limpiarSesion,
  marcarCambioPasswordRequerido,
  obtenerSesion,
  obtenerToken,
} from '@/lib/sesion'

/** Base de la API: la única constante con la ruta (mismo origen; proxy de Vite, Vercel o Caddy). */
export const BASE_API = '/api/inventario/v1'

/** Lo exige la API en refresh y logout (protección CSRF). */
export const ENCABEZADO_CSRF = { 'X-Requested-With': 'inventario-syp-web' } as const

export const TIEMPO_POR_INTENTO_MS = 30_000
export const ESPERA_MAXIMA_MS = 90_000
export const ESPERAS_MS = [2_000, 4_000, 8_000, 16_000, 32_000] as const

type SesionRespuesta = components['schemas']['SesionRespuestaDto']

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type OpcionesSolicitud = {
  metodo?: Metodo
  cuerpo?: unknown
  encabezados?: Record<string, string>
  /** No intentar refresh ante un 401 (login y refresh: evita el bucle). */
  sinRefresh?: boolean
  /** Reintentar también ante 504 o tiempo agotado (por defecto solo GET). Nunca en escrituras con efecto. */
  idempotente?: boolean
  /** Tiempo máximo por intento (por defecto TIEMPO_POR_INTENTO_MS). Solo para operaciones largas (importación). */
  tiempoMs?: number
  /**
   * Operación larga detrás del proxy (Vercel → Render): el proxy puede cortar con 502 mientras la API sigue
   * procesando. Ese 502 se trata como un 504 (quizá llegó): una escritura no se repite.
   */
  proxyPuedeCortar?: boolean
  senal?: AbortSignal
}

type Manejadores = {
  /** La sesión terminó (refresh rechazado o logout en otra pestaña): ir a /login. */
  alExpirarSesion: () => void
  /** 403 CAMBIO_PASSWORD_REQUERIDO: ir a /cambiar-password. */
  alRequerirCambioPassword: () => void
}

let manejadores: Manejadores = { alExpirarSesion: () => {}, alRequerirCambioPassword: () => {} }
let coordinador: Coordinador | null = null
let quitarOyenteLogout: (() => void) | null = null

function obtenerCoordinador(): Coordinador {
  if (!coordinador) {
    coordinador = crearCoordinador()
    // Logout en otra pestaña: esta también cierra su sesión (solo borra su token de memoria).
    quitarOyenteLogout = coordinador.alRecibirLogout(() => {
      if (obtenerSesion().estado === 'autenticado') {
        limpiarSesion()
        manejadores.alExpirarSesion()
      }
    })
  }
  return coordinador
}

/** La app registra aquí la navegación (router) al arrancar. */
export function configurarCliente(nuevos: Partial<Manejadores>) {
  manejadores = { ...manejadores, ...nuevos }
  obtenerCoordinador()
}

/** Cierra el canal entre pestañas (pruebas y desmontaje). */
export function detenerCliente() {
  quitarOyenteLogout?.()
  coordinador?.cerrar()
  coordinador = null
  quitarOyenteLogout = null
}

// ---------------------------------------------------------------------------------------------------------------
// Envío con "despertar servidor"
// ---------------------------------------------------------------------------------------------------------------

class TiempoAgotado extends Error {}

function dormir(ms: number, senal?: AbortSignal) {
  return new Promise<void>((resolver, rechazar) => {
    const temporizador = setTimeout(resolver, ms)
    senal?.addEventListener('abort', () => {
      clearTimeout(temporizador)
      rechazar(senal.reason)
    }, { once: true })
  })
}

async function fetchConTiempo(url: string, init: RequestInit, tiempoMs: number, senal?: AbortSignal): Promise<Response> {
  const control = new AbortController()
  let agotado = false
  const temporizador = setTimeout(() => {
    agotado = true
    control.abort()
  }, tiempoMs)
  const reenviarAbort = () => control.abort(senal?.reason)
  senal?.addEventListener('abort', reenviarAbort, { once: true })
  try {
    return await fetch(url, { ...init, signal: control.signal })
  } catch (error) {
    if (agotado) throw new TiempoAgotado()
    throw error
  } finally {
    clearTimeout(temporizador)
    senal?.removeEventListener('abort', reenviarAbort)
  }
}

async function enviar(ruta: string, opciones: OpcionesSolicitud, token: string | null): Promise<Response> {
  const metodo = opciones.metodo ?? 'GET'
  const idempotente = opciones.idempotente ?? (metodo === 'GET')
  const encabezados: Record<string, string> = { Accept: 'application/json', ...opciones.encabezados }
  if (opciones.cuerpo !== undefined) encabezados['Content-Type'] = 'application/json'
  if (token) encabezados.Authorization = `Bearer ${token}`
  const init: RequestInit = {
    method: metodo,
    headers: encabezados,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    credentials: 'same-origin',
    cache: 'no-store',
  }

  const inicio = Date.now()
  let intento = 0
  let despertando = false
  try {
    for (;;) {
      // 'no-llego': 502/503 o sin conexión (la API no recibió la petición) → siempre se puede repetir.
      // 'quiza-llego': 504 o tiempo agotado → solo se repite si es idempotente (no duplicar una escritura).
      let fallo: 'no-llego' | 'quiza-llego'
      let respuesta: Response | null = null
      try {
        respuesta = await fetchConTiempo(BASE_API + ruta, init, opciones.tiempoMs ?? TIEMPO_POR_INTENTO_MS, opciones.senal)
        if (respuesta.status === 502 && opciones.proxyPuedeCortar) fallo = 'quiza-llego'
        else if (respuesta.status === 502 || respuesta.status === 503) fallo = 'no-llego'
        else if (respuesta.status === 504) fallo = 'quiza-llego'
        else return respuesta
      } catch (error) {
        if (opciones.senal?.aborted) throw error
        fallo = error instanceof TiempoAgotado ? 'quiza-llego' : 'no-llego'
      }

      if (fallo === 'quiza-llego' && !idempotente) {
        throw new ErrorApi(0, SIN_RESPUESTA, 'El servidor no respondió a tiempo.')
      }
      const espera = ESPERAS_MS[Math.min(intento, ESPERAS_MS.length - 1)]
      if (Date.now() - inicio + espera > ESPERA_MAXIMA_MS) {
        if (respuesta) return respuesta
        throw new ErrorApi(0, fallo === 'no-llego' ? SIN_CONEXION : SIN_RESPUESTA, 'No se pudo conectar con el servidor.')
      }
      if (!despertando) {
        despertando = true
        empezarDespertar()
      }
      await dormir(espera, opciones.senal)
      intento += 1
    }
  } finally {
    if (despertando) terminarDespertar()
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------------------------------------------

const CODIGO_POR_ESTADO: Record<number, string> = {
  400: 'VALIDACION',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'NO_ENCONTRADO',
  429: 'DEMASIADAS_SOLICITUDES',
}

const esObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null

async function errorDe(respuesta: Response): Promise<ErrorApi> {
  let cuerpo: unknown = null
  try {
    cuerpo = await respuesta.clone().json()
  } catch {
    cuerpo = null
  }
  const requestId = respuesta.headers.get('X-Request-Id') ?? undefined
  if (esObjeto(cuerpo) && typeof cuerpo.codigo === 'string') {
    const mensaje = typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : ''
    const detalle = esObjeto(cuerpo.detalle) ? (cuerpo.detalle as Detalle) : undefined
    return new ErrorApi(respuesta.status, cuerpo.codigo, mensaje, detalle, requestId)
  }
  const codigo = CODIGO_POR_ESTADO[respuesta.status] ?? (respuesta.status >= 500 ? 'ERROR_INTERNO' : 'VALIDACION')
  return new ErrorApi(respuesta.status, codigo, '', undefined, requestId)
}

async function leer<T>(respuesta: Response): Promise<T> {
  if (respuesta.status === 204) return undefined as T
  const tipo = respuesta.headers.get('Content-Type') ?? ''
  if (!tipo.includes('json')) return undefined as T
  return (await respuesta.json()) as T
}

// ---------------------------------------------------------------------------------------------------------------
// Refresh: single-flight en la pestaña + candado entre pestañas
// ---------------------------------------------------------------------------------------------------------------

export type ResultadoRefresh = 'ok' | 'rechazado' | 'sin-conexion'

let refreshEnCurso: Promise<ResultadoRefresh> | null = null

async function hacerRefresh(): Promise<ResultadoRefresh> {
  let respuesta: Response
  try {
    respuesta = await enviar('/auth/refresh', { metodo: 'POST', encabezados: { ...ENCABEZADO_CSRF } }, null)
  } catch {
    return 'sin-conexion'
  }
  // 429 o 5xx: la API no usó la cookie, la sesión sigue viva. 401/403: sesión terminada.
  if (!respuesta.ok) return respuesta.status >= 500 || respuesta.status === 429 ? 'sin-conexion' : 'rechazado'
  const sesion = await leer<SesionRespuesta>(respuesta)
  establecerSesion(sesion.accessToken, sesion.usuario)
  return 'ok'
}

/**
 * Pide un access token nuevo. Si ya hay un refresh en curso en esta pestaña, devuelve ese mismo (single-flight);
 * entre pestañas espera el candado y luego hace su PROPIO refresh con la cookie ya rotada.
 */
export function refrescarSesion(): Promise<ResultadoRefresh> {
  refreshEnCurso ??= obtenerCoordinador()
    .conCandado(hacerRefresh)
    .finally(() => {
      refreshEnCurso = null
    })
  return refreshEnCurso
}

function sesionExpirada() {
  limpiarSesion()
  manejadores.alExpirarSesion()
}

// ---------------------------------------------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------------------------------------------

async function ejecutar(ruta: string, opciones: OpcionesSolicitud): Promise<Response> {
  let respuesta = await enviar(ruta, opciones, obtenerToken())

  // CREDENCIALES_INVALIDAS (p. ej. contraseña actual incorrecta) no es un token vencido: no se refresca.
  if (respuesta.status === 401 && !opciones.sinRefresh && (await errorDe(respuesta)).codigo !== 'CREDENCIALES_INVALIDAS') {
    const resultado = await refrescarSesion()
    if (resultado === 'sin-conexion') throw new ErrorApi(0, SIN_CONEXION, 'No se pudo renovar la sesión.')
    if (resultado === 'rechazado') {
      const error = await errorDe(respuesta)
      sesionExpirada()
      throw error
    }
    // Un solo reintento con el token nuevo.
    respuesta = await enviar(ruta, opciones, obtenerToken())
    if (respuesta.status === 401) {
      const error = await errorDe(respuesta)
      sesionExpirada()
      throw error
    }
  }

  if (!respuesta.ok) {
    const error = await errorDe(respuesta)
    if (respuesta.status === 403 && error.codigo === 'CAMBIO_PASSWORD_REQUERIDO') {
      marcarCambioPasswordRequerido()
      manejadores.alRequerirCambioPassword()
    }
    throw error
  }
  return respuesta
}

/** Llama a la API y devuelve el JSON tipado. Lanza ErrorApi con { status, codigo, mensaje, detalle }. */
export async function solicitar<T>(ruta: string, opciones: OpcionesSolicitud = {}): Promise<T> {
  return leer<T>(await ejecutar(ruta, opciones))
}

/** Archivo de la API (PDF o Excel) tal como llega, con el encabezado Content-Disposition para el nombre. */
export type ArchivoApi = { blob: Blob; contentDisposition: string | null; tipo: string | null }

/** Tiempo por intento al generar un archivo (un PDF o Excel del año completo puede tardar). */
export const TIEMPO_DESCARGA_MS = 120_000

/**
 * Descarga un archivo (GET) con las mismas reglas que `solicitar`: token, refresh, un reintento tras 401 y
 * "Despertando el servidor…". Los errores llegan igual como ErrorApi (la API responde JSON aunque se pida un PDF).
 */
export async function solicitarArchivo(ruta: string, opciones: Omit<OpcionesSolicitud, 'metodo' | 'cuerpo'> = {}): Promise<ArchivoApi> {
  const respuesta = await ejecutar(ruta, {
    tiempoMs: TIEMPO_DESCARGA_MS,
    ...opciones,
    encabezados: { Accept: '*/*', ...opciones.encabezados },
  })
  return {
    blob: await respuesta.blob(),
    contentDisposition: respuesta.headers.get('Content-Disposition'),
    tipo: respuesta.headers.get('Content-Type'),
  }
}

/** Avisa a las demás pestañas que esta cerró sesión (sin datos). */
export function avisarLogoutAPestanas() {
  obtenerCoordinador().avisarLogout()
}
