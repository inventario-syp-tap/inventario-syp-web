// Validación del diálogo del control de tonelaje (mensajes en español). Las toneladas viajan como texto con hasta 4
// decimales; la fuente no lleva nombres de personas (D-25) y por defecto es "REPORTE EXTERNO".
import { z } from 'zod'

export const MAXIMO_OBSERVACION = 500
export const MAXIMO_FUENTE = 60

export const esquemaTonelaje = z.object({
  toneladasReportadas: z.string().trim()
    .min(1, 'Indica las toneladas reportadas.')
    .regex(/^\d+(\.\d{1,4})?$/, 'Las toneladas admiten hasta 4 decimales (por ejemplo, 22.5000).'),
  fuente: z.string().trim()
    .min(1, 'Indica la fuente del reporte (por ejemplo, REPORTE EXTERNO).')
    .max(MAXIMO_FUENTE, `La fuente admite hasta ${MAXIMO_FUENTE} caracteres.`),
  observacion: z.string().trim().max(MAXIMO_OBSERVACION, `La observación admite hasta ${MAXIMO_OBSERVACION} caracteres.`),
})

export type FormularioTonelaje = z.infer<typeof esquemaTonelaje>
