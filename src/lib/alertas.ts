// Textos de las alertas del kardex (docs/UI-UX.md §4): los usa IconoAlerta y los resúmenes en texto.
export const TEXTO_ALERTA: Record<string, string> = {
  STOCK_NEGATIVO: 'Stock negativo',
  FECHA_FUERA_DE_ORDEN: 'Fecha anterior al movimiento previo',
  SALDO_CERO_CON_COSTO: 'Saldo cero con costo',
  SI_DESACTUALIZADO: 'Saldo inicial desactualizado',
  LIBRO_PENDIENTE_IMPRESION: 'Libro 12.1 pendiente de impresión',
}

/** Texto de una alerta (para listas y lectores de pantalla); un código desconocido se muestra tal cual. */
export const textoAlerta = (codigo: string) => TEXTO_ALERTA[codigo] ?? codigo
