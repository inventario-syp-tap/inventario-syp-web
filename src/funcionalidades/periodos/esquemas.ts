// Validación de los formularios de Periodos con los mismos límites que la API (ReabrirPeriodoDto: motivo obligatorio,
// hasta 500 caracteres · CerrarEnBloqueDto: desde y hasta en AAAA-MM).
import { z } from 'zod'
import { MAXIMO_MOTIVO } from '@/componentes/comunes/dialogo-confirmacion'

export const esquemaReabrir = z.object({
  motivo: z.string()
    .trim()
    .min(1, 'Escribe el motivo de la reapertura.')
    .max(MAXIMO_MOTIVO, `El motivo admite hasta ${MAXIMO_MOTIVO} caracteres.`),
})
export type FormularioReabrir = z.infer<typeof esquemaReabrir>

const periodo = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Elige el mes (AAAA-MM).')

export const esquemaBloque = z.object({ desde: periodo, hasta: periodo })
  .refine((v) => v.hasta >= v.desde, { path: ['hasta'], message: '«Hasta» no puede ser anterior a «Desde».' })
export type FormularioBloque = z.infer<typeof esquemaBloque>
