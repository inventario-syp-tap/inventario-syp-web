// Claves de TanStack Query por recurso. Cada pantalla agrega sus filtros detrás: [...CLAVES.kardex, { anio }].
export const CLAVES = {
  kardex: ['kardex'],
  stock: ['stock'],
  dashboard: ['dashboard'],
  periodos: ['periodos'],
  comprobantes: ['comprobantes'],
  paridad: ['importacion', 'paridad'],
  catalogos: ['catalogos'],
  productos: ['productos'],
  terceros: ['terceros'],
  reglas: ['reglas-contables'],
  establecimientos: ['establecimientos'],
  configuracion: ['configuracion'],
  usuarios: ['usuarios'],
} as const

/** Lo que cambia cuando se registra, edita, anula o cierra algo (o se carga el histórico). */
export const CLAVES_AFECTADAS_POR_ESCRITURA = [
  CLAVES.kardex,
  CLAVES.stock,
  CLAVES.dashboard,
  CLAVES.periodos,
  CLAVES.comprobantes,
] as const
