// Lectura de lo que se escribe en un campo decimal (CampoDecimal). Solo texto: nunca se convierte a number.

/** Limpia lo escrito: coma → punto, solo dígitos y un punto, a lo más `decimales` decimales. Devuelve null si no sirve. */
export function normalizarDecimal(texto: string, decimales: number, permitirNegativo = false): string | null {
  const limpio = texto.replace(/\s/g, '').replace(',', '.')
  const patron = new RegExp(`^${permitirNegativo ? '-?' : ''}\\d*${decimales > 0 ? `(\\.\\d{0,${decimales}})?` : ''}$`)
  return patron.test(limpio) ? limpio : null
}
