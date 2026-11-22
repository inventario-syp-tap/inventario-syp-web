// Validación del diálogo «Exportar a WinConta» (mensajes en español). Las mismas reglas que la API (400 VALIDACION):
// número de asiento con exactamente 4 dígitos (texto, conserva los ceros: "0001") y tipo de cambio mayor que 0 con
// hasta 3 decimales (texto: nunca se convierte a número).
import { z } from 'zod'

const CERO = /^0+(\.0*)?$/

export const esquemaExportarWinConta = z.object({
  numeroAsiento: z.string().trim()
    .min(1, 'Indica el número de asiento.')
    .regex(/^\d{4}$/, 'El número de asiento debe tener exactamente 4 dígitos (por ejemplo, 0001).'),
  tipoCambio: z.string().trim()
    .min(1, 'Indica el tipo de cambio.')
    .regex(/^\d+(\.\d{1,3})?$/, 'El tipo de cambio admite hasta 3 decimales (por ejemplo, 3.750).')
    .refine((valor) => !CERO.test(valor), 'El tipo de cambio debe ser mayor que 0.'),
})

export type FormularioExportarWinConta = z.infer<typeof esquemaExportarWinConta>
