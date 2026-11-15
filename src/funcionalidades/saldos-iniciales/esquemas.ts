// Saldo inicial manual (EditarSaldoInicialDto): cantidad TN hasta 4 decimales, costo total S/ hasta 10 y motivo
// obligatorio (hasta 500). Los decimales se validan y se envían como texto: nunca se convierten a number.
import { z } from 'zod'
import { MAXIMO_MOTIVO } from '@/componentes/comunes/dialogo-confirmacion'

const decimal = (decimales: number, campo: string) =>
  z.string()
    .trim()
    .min(1, `Indica ${campo}.`)
    .regex(new RegExp(`^\\d+(\\.\\d{1,${decimales}})?$`), `${campo.charAt(0).toUpperCase()}${campo.slice(1)}: número con hasta ${decimales} decimales.`)

export const esquemaSaldoInicial = z.object({
  cantidad: decimal(4, 'la cantidad'),
  costoTotal: decimal(10, 'el costo total'),
  motivo: z.string()
    .trim()
    .min(1, 'Escribe el motivo del cambio.')
    .max(MAXIMO_MOTIVO, `El motivo admite hasta ${MAXIMO_MOTIVO} caracteres.`),
})

export type FormularioSaldoInicial = z.infer<typeof esquemaSaldoInicial>
