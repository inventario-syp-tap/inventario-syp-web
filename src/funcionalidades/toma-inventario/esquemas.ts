// Validación de la toma de inventario (mensajes en español). Cantidades como texto con hasta 4 decimales (nunca
// número). Al resolver: una acción por cada producto con diferencia; la MERMA solo con faltantes; NINGUNA exige
// observación; MERMA exige el sustento del informe técnico y AJUSTE el del acta (las mismas reglas que la API:
// ACCION_NO_CORRESPONDE, OBSERVACION_REQUERIDA y SUSTENTO_REQUERIDO).
import { z } from 'zod'

export const MAXIMO_TEXTO = 500
export const MAXIMO_RESPONSABLE = 120

const CANTIDAD = /^\d+(\.\d{1,4})?$/

export const esquemaNuevaToma = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica la fecha de la toma.'),
  responsable: z.string().trim()
    .min(1, 'Indica quién hizo el conteo (nombre o cargo).')
    .max(MAXIMO_RESPONSABLE, `El responsable admite hasta ${MAXIMO_RESPONSABLE} caracteres.`),
  observacion: z.string().trim().max(MAXIMO_TEXTO, `La observación admite hasta ${MAXIMO_TEXTO} caracteres.`),
  lineas: z.array(z.object({
    productoId: z.number(),
    cantidadContada: z.string().trim()
      .min(1, 'Indica la cantidad contada (0 si no hay).')
      .regex(CANTIDAD, 'Hasta 4 decimales, sin signo (por ejemplo, 14.7500).'),
  })).min(1, 'No hay productos activos para contar.'),
})

export type FormularioNuevaToma = z.infer<typeof esquemaNuevaToma>

export const ACCIONES = ['MERMA', 'AJUSTE', 'NINGUNA'] as const

export const esquemaResolverToma = z.object({
  lineas: z.array(z.object({
    productoId: z.number(),
    tipoDiferencia: z.enum(['FALTANTE', 'SOBRANTE', 'SIN_DIFERENCIA']),
    accion: z.union([z.enum(ACCIONES), z.literal('')]),
    observacion: z.string().trim().max(MAXIMO_TEXTO, `La observación admite hasta ${MAXIMO_TEXTO} caracteres.`),
  })),
  sustentoMerma: z.string().trim().max(MAXIMO_TEXTO, `El sustento admite hasta ${MAXIMO_TEXTO} caracteres.`),
  anioInforme: z.string().trim(),
  sustentoAjuste: z.string().trim().max(MAXIMO_TEXTO, `El sustento admite hasta ${MAXIMO_TEXTO} caracteres.`),
}).superRefine((valores, ctx) => {
  valores.lineas.forEach((linea, i) => {
    if (linea.accion === '') {
      ctx.addIssue({ code: 'custom', path: ['lineas', i, 'accion'], message: 'Elige una acción para este producto.' })
    } else if (linea.accion === 'MERMA' && linea.tipoDiferencia !== 'FALTANTE') {
      ctx.addIssue({ code: 'custom', path: ['lineas', i, 'accion'], message: 'La merma solo corresponde a un faltante.' })
    } else if (linea.accion === 'NINGUNA' && linea.observacion === '') {
      ctx.addIssue({ code: 'custom', path: ['lineas', i, 'observacion'], message: 'Indica por qué no se registra ninguna acción.' })
    }
  })
  if (valores.lineas.some((l) => l.accion === 'MERMA')) {
    if (valores.sustentoMerma === '') {
      ctx.addIssue({ code: 'custom', path: ['sustentoMerma'], message: 'Indica el sustento de la merma (informe técnico).' })
    }
    if (!/^\d{4}$/.test(valores.anioInforme)) {
      ctx.addIssue({ code: 'custom', path: ['anioInforme'], message: 'Indica el año del informe técnico (4 dígitos).' })
    }
  }
  if (valores.lineas.some((l) => l.accion === 'AJUSTE') && valores.sustentoAjuste === '') {
    ctx.addIssue({ code: 'custom', path: ['sustentoAjuste'], message: 'Indica el sustento del ajuste (acta de la toma de inventario).' })
  }
})

export type FormularioResolverToma = z.infer<typeof esquemaResolverToma>
