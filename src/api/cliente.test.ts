import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearBusCanales, crearLocksFalsos, instalarLocks, respuestaJson, usuarioDemo } from '@/pruebas/falsos'

type Enrutador = (url: string, init: RequestInit) => Promise<Response> | Response

let bus: ReturnType<typeof crearBusCanales>

/** Carga un juego NUEVO de módulos: cada llamada simula una pestaña distinta (su propia memoria). */
async function abrirPestana() {
  vi.resetModules()
  const cliente = await import('./cliente')
  const auth = await import('./auth')
  const sesion = await import('@/lib/sesion')
  const estado = await import('./estado-servidor')
  const manejadores = { alExpirarSesion: vi.fn(), alRequerirCambioPassword: vi.fn() }
  cliente.configurarCliente(manejadores)
  return { cliente, auth, sesion, estado, manejadores }
}

const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))
const autorizacion = (init: RequestInit = {}) => new Headers(init.headers).get('Authorization')
const sesionRespuesta = (token: string, roles?: string[]) => respuestaJson({ accessToken: token, usuario: usuarioDemo(roles) })
const noAutenticado = () => respuestaJson({ codigo: 'NO_AUTENTICADO', mensaje: 'Token vencido' }, 401)

function usarFetch(enrutador: Enrutador) {
  const simulado = vi.fn((url: string, init: RequestInit = {}) => Promise.resolve(enrutador(url, init)))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const llamadasA = (simulado: ReturnType<typeof usarFetch>, sufijo: string) =>
  simulado.mock.calls.filter(([url]) => url.endsWith(sufijo))

beforeEach(() => {
  bus = crearBusCanales()
  vi.stubGlobal('BroadcastChannel', bus.CanalFalso)
  instalarLocks(crearLocksFalsos())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  instalarLocks(undefined)
})

describe('cliente de la API: sesión y refresh', () => {
  it('usa la base /api/inventario/v1 y envía el token de memoria', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-demo', usuarioDemo())
    const simulado = usarFetch(() => respuestaJson({ ok: true }))
    await p.cliente.solicitar('/catalogos')
    const [url, init] = simulado.mock.calls[0]
    expect(url).toBe('/api/inventario/v1/catalogos')
    expect(autorizacion(init)).toBe('Bearer token-demo')
  })

  it('varias 401 a la vez hacen UN solo refresh y cada petición se reintenta una vez', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-vencido', usuarioDemo())
    const simulado = usarFetch(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        await pausa(5)
        return sesionRespuesta('token-nuevo')
      }
      return autorizacion(init) === 'Bearer token-nuevo' ? respuestaJson({ ok: true }) : noAutenticado()
    })

    const resultados = await Promise.all([1, 2, 3].map(() => p.cliente.solicitar<{ ok: boolean }>('/catalogos')))

    expect(resultados).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(llamadasA(simulado, '/auth/refresh')).toHaveLength(1)
    expect(llamadasA(simulado, '/catalogos')).toHaveLength(6)
    expect(p.sesion.obtenerToken()).toBe('token-nuevo')
  })

  it('el refresh va sin Authorization, con la cookie del mismo origen y el header X-Requested-With', async () => {
    const p = await abrirPestana()
    const simulado = usarFetch(() => sesionRespuesta('token-nuevo'))
    await p.cliente.refrescarSesion()
    const [, init = {}] = llamadasA(simulado, '/auth/refresh')[0]
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(autorizacion(init)).toBeNull()
    expect(new Headers(init.headers).get('X-Requested-With')).toBe('inventario-syp-web')
  })

  it('si el reintento vuelve a dar 401 no hay un segundo refresh: cierra la sesión', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-vencido', usuarioDemo())
    const simulado = usarFetch((url) => (url.endsWith('/auth/refresh') ? sesionRespuesta('token-nuevo') : noAutenticado()))

    await expect(p.cliente.solicitar('/catalogos')).rejects.toMatchObject({ status: 401, codigo: 'NO_AUTENTICADO' })
    expect(llamadasA(simulado, '/auth/refresh')).toHaveLength(1)
    expect(llamadasA(simulado, '/catalogos')).toHaveLength(2)
    expect(p.sesion.obtenerSesion().estado).toBe('anonimo')
    expect(p.manejadores.alExpirarSesion).toHaveBeenCalledOnce()
  })

  it('refresh rechazado: limpia la sesión y lleva a /login', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-vencido', usuarioDemo())
    usarFetch((url) =>
      url.endsWith('/auth/refresh') ? respuestaJson({ codigo: 'NO_AUTENTICADO', mensaje: '' }, 401) : noAutenticado())

    await expect(p.cliente.solicitar('/catalogos')).rejects.toMatchObject({ codigo: 'NO_AUTENTICADO' })
    expect(p.sesion.obtenerToken()).toBeNull()
    expect(p.manejadores.alExpirarSesion).toHaveBeenCalledOnce()
  })

  it('un 401 del login nunca dispara el refresh', async () => {
    const p = await abrirPestana()
    const simulado = usarFetch(() => respuestaJson({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: '' }, 401))

    await expect(p.auth.iniciarSesion({ email: 'contadora.demo@syp.invalid', password: 'incorrecta' }))
      .rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS' })
    expect(simulado).toHaveBeenCalledTimes(1)
    expect(llamadasA(simulado, '/auth/refresh')).toHaveLength(0)
  })

  it('CREDENCIALES_INVALIDAS en otra ruta (contraseña actual incorrecta) tampoco refresca', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-demo', usuarioDemo())
    const simulado = usarFetch(() => respuestaJson({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: '' }, 401))

    await expect(p.auth.cambiarPassword({ actual: 'incorrecta', nueva: 'una-clave-nueva-larga' }))
      .rejects.toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS' })
    expect(llamadasA(simulado, '/auth/refresh')).toHaveLength(0)
    expect(p.sesion.obtenerSesion().estado).toBe('autenticado')
  })

  it('403 CAMBIO_PASSWORD_REQUERIDO lleva a /cambiar-password SIN refresh ni reintento', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-demo', usuarioDemo())
    const simulado = usarFetch(() => respuestaJson({ codigo: 'CAMBIO_PASSWORD_REQUERIDO', mensaje: '' }, 403))

    await expect(p.cliente.solicitar('/catalogos')).rejects.toMatchObject({ status: 403, codigo: 'CAMBIO_PASSWORD_REQUERIDO' })
    expect(simulado).toHaveBeenCalledTimes(1)
    expect(llamadasA(simulado, '/auth/refresh')).toHaveLength(0)
    expect(p.manejadores.alRequerirCambioPassword).toHaveBeenCalledOnce()
    expect(p.sesion.obtenerSesion().usuario?.debeCambiarPassword).toBe(true)
    expect(p.sesion.obtenerToken()).toBe('token-demo')
  })

  it('convierte el cuerpo { codigo, mensaje, detalle } en ErrorApi con el requestId', async () => {
    const p = await abrirPestana()
    usarFetch(() =>
      respuestaJson({ codigo: 'PERIODO_CERRADO', mensaje: 'cerrado', detalle: { mes: 3 } }, 409, { 'X-Request-Id': 'req-1' }))
    await expect(p.cliente.solicitar('/periodos')).rejects.toMatchObject({
      status: 409, codigo: 'PERIODO_CERRADO', detalle: { mes: 3 }, requestId: 'req-1',
    })
  })
})

describe('cliente de la API: servidor dormido', () => {
  it('ante 503 reintenta con esperas crecientes y muestra "despertando" mientras tanto', async () => {
    vi.useFakeTimers()
    const p = await abrirPestana()
    let intentos = 0
    const simulado = usarFetch(() => (++intentos < 3 ? respuestaJson({}, 503) : respuestaJson({ estado: 'ok' })))

    const promesa = p.cliente.solicitar('/salud')
    await vi.advanceTimersByTimeAsync(0)
    expect(p.estado.estaDespertando()).toBe(true)
    expect(simulado).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(simulado).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3_999)
    expect(simulado).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await expect(promesa).resolves.toEqual({ estado: 'ok' })
    expect(simulado).toHaveBeenCalledTimes(3)
    expect(p.estado.estaDespertando()).toBe(false)
  })

  it('se rinde a los ~90 s y devuelve el error', async () => {
    vi.useFakeTimers()
    const p = await abrirPestana()
    const simulado = usarFetch(() => respuestaJson({}, 503))

    const promesa = p.cliente.solicitar('/salud')
    const verificacion = expect(promesa).rejects.toMatchObject({ status: 503 })
    await vi.advanceTimersByTimeAsync(90_000)
    await verificacion
    // 2 + 4 + 8 + 16 + 32 = 62 s; la siguiente espera (32 s) pasaría de 90 s.
    expect(simulado).toHaveBeenCalledTimes(6)
    expect(p.estado.estaDespertando()).toBe(false)
  })

  it('un GET con tiempo agotado se reintenta', async () => {
    vi.useFakeTimers()
    const p = await abrirPestana()
    let intentos = 0
    usarFetch((_url, init) => {
      intentos += 1
      if (intentos > 1) return respuestaJson({ ok: true })
      return new Promise<Response>((_resolver, rechazar) => {
        init.signal?.addEventListener('abort', () => rechazar(new DOMException('Abortado', 'AbortError')))
      })
    })

    const promesa = p.cliente.solicitar('/catalogos')
    await vi.advanceTimersByTimeAsync(30_000 + 2_000)
    await expect(promesa).resolves.toEqual({ ok: true })
    expect(intentos).toBe(2)
  })

  it('una escritura con 504 NO se repite (podría duplicarse): avisa que revise', async () => {
    const p = await abrirPestana()
    const simulado = usarFetch(() => respuestaJson({}, 504))
    await expect(p.cliente.solicitar('/comprobantes/compras', { metodo: 'POST', cuerpo: {} }))
      .rejects.toMatchObject({ codigo: 'SIN_RESPUESTA' })
    expect(simulado).toHaveBeenCalledTimes(1)
  })

  it('una escritura con 503 sí se repite (la API no la recibió)', async () => {
    vi.useFakeTimers()
    const p = await abrirPestana()
    let intentos = 0
    const simulado = usarFetch(() => (++intentos === 1 ? respuestaJson({}, 503) : respuestaJson({ id: 1 }, 201)))
    const promesa = p.cliente.solicitar('/comprobantes/compras', { metodo: 'POST', cuerpo: {} })
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(promesa).resolves.toEqual({ id: 1 })
    expect(simulado).toHaveBeenCalledTimes(2)
  })

  it('tiempoMs amplía el tiempo por intento de una operación larga', async () => {
    vi.useFakeTimers()
    const p = await abrirPestana()
    let senal: AbortSignal | null | undefined
    usarFetch((_url, init) => {
      senal = init.signal
      return new Promise<Response>((resolver) => setTimeout(() => resolver(respuestaJson({ ok: true }, 201)), 120_000))
    })
    const promesa = p.cliente.solicitar('/importacion/historico', { metodo: 'POST', tiempoMs: 240_000 })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(senal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(90_000)
    await expect(promesa).resolves.toEqual({ ok: true })
  })

  it('con proxyPuedeCortar un 502 en una escritura NO se repite: avisa que revise', async () => {
    const p = await abrirPestana()
    const simulado = usarFetch(() => respuestaJson({}, 502))
    await expect(p.cliente.solicitar('/importacion/historico', { metodo: 'POST', proxyPuedeCortar: true }))
      .rejects.toMatchObject({ codigo: 'SIN_RESPUESTA' })
    expect(simulado).toHaveBeenCalledTimes(1)
  })
})

describe('cliente de la API: coordinación entre pestañas', () => {
  /** Servidor con rotación de cookie: reutilizar una cookie ya rotada cierra la sesión (como la API). */
  function servidorConRotacion() {
    const estado = { cookieNavegador: 'cookie-0', vigente: 'cookie-0', rotaciones: 0, simultaneos: 0, maxSimultaneos: 0, reutilizaciones: 0 }
    const enrutador: Enrutador = async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        const enviada = estado.cookieNavegador // el navegador adjunta la cookie al enviar
        estado.simultaneos += 1
        estado.maxSimultaneos = Math.max(estado.maxSimultaneos, estado.simultaneos)
        await pausa(10)
        estado.simultaneos -= 1
        if (enviada !== estado.vigente) {
          estado.reutilizaciones += 1
          return respuestaJson({ codigo: 'NO_AUTENTICADO', mensaje: '' }, 401)
        }
        estado.rotaciones += 1
        estado.vigente = `cookie-${estado.rotaciones}`
        estado.cookieNavegador = estado.vigente // Set-Cookie: la comparten todas las pestañas
        return sesionRespuesta(`token-secreto-${estado.rotaciones}`)
      }
      if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 })
      return autorizacion(init)?.startsWith('Bearer token-secreto-') ? respuestaJson({ ok: true }) : noAutenticado()
    }
    return { estado, enrutador }
  }

  it('con navigator.locks dos pestañas refrescan de una en una, cada una con su propio token', async () => {
    const a = await abrirPestana()
    const b = await abrirPestana()
    a.sesion.establecerSesion('token-vencido-a', usuarioDemo())
    b.sesion.establecerSesion('token-vencido-b', usuarioDemo())
    const servidor = servidorConRotacion()
    usarFetch(servidor.enrutador)

    await Promise.all([a.cliente.solicitar('/catalogos'), b.cliente.solicitar('/catalogos')])

    expect(servidor.estado.maxSimultaneos).toBe(1)
    expect(servidor.estado.reutilizaciones).toBe(0)
    expect(servidor.estado.rotaciones).toBe(2) // cada pestaña hizo SU refresh con la cookie ya rotada
    expect(a.sesion.obtenerToken()).not.toBe(b.sesion.obtenerToken())
    expect(a.manejadores.alExpirarSesion).not.toHaveBeenCalled()
    expect(b.manejadores.alExpirarSesion).not.toHaveBeenCalled()
  })

  it('sin navigator.locks usa el candado de respaldo con BroadcastChannel', async () => {
    instalarLocks(undefined)
    const a = await abrirPestana()
    const b = await abrirPestana()
    a.sesion.establecerSesion('token-vencido-a', usuarioDemo())
    b.sesion.establecerSesion('token-vencido-b', usuarioDemo())
    const servidor = servidorConRotacion()
    usarFetch(servidor.enrutador)

    await Promise.all([a.cliente.solicitar('/catalogos'), b.cliente.solicitar('/catalogos')])

    expect(servidor.estado.maxSimultaneos).toBe(1)
    expect(servidor.estado.reutilizaciones).toBe(0)
    expect(servidor.estado.rotaciones).toBe(2)
  })

  it('control: SIN coordinación los dos refresh salen a la vez y la API ve una reutilización', async () => {
    instalarLocks(undefined)
    vi.stubGlobal('BroadcastChannel', undefined)
    const a = await abrirPestana()
    const b = await abrirPestana()
    a.sesion.establecerSesion('token-vencido-a', usuarioDemo())
    b.sesion.establecerSesion('token-vencido-b', usuarioDemo())
    const servidor = servidorConRotacion()
    usarFetch(servidor.enrutador)

    await Promise.allSettled([a.cliente.solicitar('/catalogos'), b.cliente.solicitar('/catalogos')])

    expect(servidor.estado.maxSimultaneos).toBe(2)
    expect(servidor.estado.reutilizaciones).toBe(1)
  })

  it('el logout de una pestaña cierra la sesión en las demás', async () => {
    const a = await abrirPestana()
    const b = await abrirPestana()
    a.sesion.establecerSesion('token-secreto-a', usuarioDemo())
    b.sesion.establecerSesion('token-secreto-b', usuarioDemo())
    usarFetch(servidorConRotacion().enrutador)

    await a.auth.cerrarSesion()
    await vi.waitFor(() => expect(b.sesion.obtenerSesion().estado).toBe('anonimo'))
    expect(b.sesion.obtenerToken()).toBeNull()
    expect(b.manejadores.alExpirarSesion).toHaveBeenCalledOnce()
  })

  it.each([
    ['con navigator.locks', true],
    ['con el candado de respaldo', false],
  ])('ningún mensaje del canal contiene el token ni datos del usuario (%s)', async (_nombre, conLocks) => {
    if (!conLocks) instalarLocks(undefined)
    const a = await abrirPestana()
    const b = await abrirPestana()
    a.sesion.establecerSesion('token-vencido-viejo-a', usuarioDemo())
    b.sesion.establecerSesion('token-vencido-viejo-b', usuarioDemo())
    usarFetch(servidorConRotacion().enrutador)

    await Promise.all([a.cliente.solicitar('/catalogos'), b.cliente.solicitar('/catalogos')])
    const tokens = [a.sesion.obtenerToken(), b.sesion.obtenerToken(), 'token-vencido-viejo-a', 'token-vencido-viejo-b']
    await a.auth.cerrarSesion()

    expect(bus.enviados.length).toBeGreaterThan(0)
    expect(bus.enviados.map((m) => m.tipo)).toContain('refresh-terminado')
    expect(bus.enviados.map((m) => m.tipo)).toContain('logout')
    for (const mensaje of bus.enviados) {
      const texto = JSON.stringify(mensaje)
      for (const token of tokens) expect(texto).not.toContain(String(token))
      expect(texto).not.toContain('token')
      expect(texto).not.toContain('syp.invalid')
      expect(Object.keys(mensaje).every((clave) => clave === 'tipo' || clave === 'id')).toBe(true)
      expect(['refresh-iniciado', 'refresh-terminado', 'logout']).toContain(mensaje.tipo)
    }
  })
})

describe('cliente de la API: descargas de archivos', () => {
  it('solicitarArchivo envía el token, acepta cualquier tipo y devuelve el blob con Content-Disposition', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-demo', usuarioDemo())
    const simulado = usarFetch(() => new Response('%PDF-demo', {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="libro-12-1-2026-01.pdf"' },
    }))
    const archivo = await p.cliente.solicitarArchivo('/libros/12-1?anio=2026&mes=1&formato=pdf')
    const [url, init] = simulado.mock.calls[0]
    expect(url).toBe('/api/inventario/v1/libros/12-1?anio=2026&mes=1&formato=pdf')
    expect(autorizacion(init)).toBe('Bearer token-demo')
    expect(new Headers(init?.headers).get('Accept')).toBe('*/*')
    expect(archivo.contentDisposition).toBe('attachment; filename="libro-12-1-2026-01.pdf"')
    expect(await archivo.blob.text()).toBe('%PDF-demo')
  })

  it('un error de la descarga llega como ErrorApi con su código (409 PERIODO_NO_CERRADO, 429 sin cuerpo)', async () => {
    const p = await abrirPestana()
    p.sesion.establecerSesion('token-demo', usuarioDemo())
    usarFetch(() => respuestaJson({ codigo: 'PERIODO_NO_CERRADO', mensaje: 'x' }, 409))
    await expect(p.cliente.solicitarArchivo('/libros/12-1?anio=2026&mes=1&formato=pdf')).rejects.toMatchObject({ status: 409, codigo: 'PERIODO_NO_CERRADO' })
    usarFetch(() => new Response('', { status: 429 }))
    await expect(p.cliente.solicitarArchivo('/reportes/toneladas?anio=2026&formato=xlsx')).rejects.toMatchObject({ status: 429, codigo: 'DEMASIADAS_SOLICITUDES' })
  })
})
