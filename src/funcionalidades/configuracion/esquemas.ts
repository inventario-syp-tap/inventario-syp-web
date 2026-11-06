// Configuración (docs/UI-UX.md §5.17). Cada pestaña envía un PATCH solo con su sección (la API las fusiona).
// Los enteros de configuración (decimales, milímetros, meses) se escriben como texto y se convierten al enviar:
// no son importes. La tolerancia en TN sí es un decimal y viaja como string.
import { z } from 'zod'
import type { CambiosConfiguracion, Configuracion } from '@/api/configuracion'

const entero = (nombre: string, minimo: number, maximo: number) =>
  z.string().trim().regex(/^\d+$/, `${nombre}: escribe un número entero.`).refine((v) => {
    const n = Number.parseInt(v, 10)
    return n >= minimo && n <= maximo
  }, `${nombre}: de ${minimo} a ${maximo}.`)

const aEntero = (texto: string) => Number.parseInt(texto, 10)
const texto = (valor: number) => String(valor)

// ---- Empresa (solo ADMIN): política de stock, redondeo del SI y asiento de merma --------------------------------
export const esquemaEmpresa = z.object({
  politicaStockNegativo: z.enum(['PERMITIR_CON_ALERTA', 'BLOQUEAR']),
  decimalesRedondeoSiCosto: entero('Decimales del redondeo', 0, 6),
  mermaEnAsientoSeparado: z.boolean(),
})
export type FormularioEmpresa = z.infer<typeof esquemaEmpresa>

export const valoresEmpresa = (c: Configuracion): FormularioEmpresa => ({
  politicaStockNegativo: c.inventario.politicaStockNegativo,
  decimalesRedondeoSiCosto: texto(c.inventario.decimalesRedondeoSiCosto),
  mermaEnAsientoSeparado: c.asientos.mermaEnAsientoSeparado,
})

export const cambiosEmpresa = (d: FormularioEmpresa): CambiosConfiguracion => ({
  inventario: { politicaStockNegativo: d.politicaStockNegativo, decimalesRedondeoSiCosto: aEntero(d.decimalesRedondeoSiCosto) },
  asientos: { mermaEnAsientoSeparado: d.mermaEnAsientoSeparado },
})

// ---- Libro 12.1 (ADMIN y CONTADOR) ------------------------------------------------------------------------------
const milimetros = (nombre: string) => entero(nombre, 0, 100)

export const esquemaLibro = z.object({
  modoPorDefecto: z.enum(['AGRUPADO', 'DETALLADO']),
  unidadMedida: z.string().min(1, 'Elige la unidad de medida.'),
  decimalesCantidad: entero('Decimales de entradas y salidas', 0, 4),
  decimalesSaldo: entero('Decimales del saldo', 0, 6),
  decimalesTotales: entero('Decimales de los totales', 0, 6),
  orientacion: z.enum(['HORIZONTAL', 'VERTICAL']),
  imprimirFolio: z.boolean(),
  margenSuperior: milimetros('Margen superior'),
  margenInferior: milimetros('Margen inferior'),
  margenIzquierdo: milimetros('Margen izquierdo'),
  margenDerecho: milimetros('Margen derecho'),
  selloAncho: milimetros('Ancho del sello'),
  selloAlto: milimetros('Alto del sello'),
  recordarImpresionMesesDespues: entero('Recordatorio', 0, 12),
  plazoLegalAtrasoMeses: entero('Plazo legal', 0, 12),
})
export type FormularioLibro = z.infer<typeof esquemaLibro>

export const valoresLibro = ({ libro }: Configuracion): FormularioLibro => ({
  modoPorDefecto: libro.modoPorDefecto,
  unidadMedida: libro.unidadMedida,
  decimalesCantidad: texto(libro.decimalesCantidad),
  decimalesSaldo: texto(libro.decimalesSaldo),
  decimalesTotales: texto(libro.decimalesTotales),
  orientacion: libro.impresion.orientacion,
  imprimirFolio: libro.impresion.imprimirFolio,
  margenSuperior: texto(libro.impresion.margenesMm.superior),
  margenInferior: texto(libro.impresion.margenesMm.inferior),
  margenIzquierdo: texto(libro.impresion.margenesMm.izquierdo),
  margenDerecho: texto(libro.impresion.margenesMm.derecho),
  selloAncho: texto(libro.impresion.reservaSelloMm.ancho),
  selloAlto: texto(libro.impresion.reservaSelloMm.alto),
  recordarImpresionMesesDespues: texto(libro.impresion.recordarImpresionMesesDespues),
  plazoLegalAtrasoMeses: texto(libro.impresion.plazoLegalAtrasoMeses),
})

export const cambiosLibro = (d: FormularioLibro): CambiosConfiguracion => ({
  libro: {
    modoPorDefecto: d.modoPorDefecto,
    unidadMedida: d.unidadMedida,
    decimalesCantidad: aEntero(d.decimalesCantidad),
    decimalesSaldo: aEntero(d.decimalesSaldo),
    decimalesTotales: aEntero(d.decimalesTotales),
    impresion: {
      orientacion: d.orientacion,
      imprimirFolio: d.imprimirFolio,
      margenesMm: {
        superior: aEntero(d.margenSuperior),
        inferior: aEntero(d.margenInferior),
        izquierdo: aEntero(d.margenIzquierdo),
        derecho: aEntero(d.margenDerecho),
      },
      reservaSelloMm: { ancho: aEntero(d.selloAncho), alto: aEntero(d.selloAlto) },
      recordarImpresionMesesDespues: aEntero(d.recordarImpresionMesesDespues),
      plazoLegalAtrasoMeses: aEntero(d.plazoLegalAtrasoMeses),
    },
  },
})

// ---- WinConta (ADMIN y CONTADOR) --------------------------------------------------------------------------------
const obligatorio = (nombre: string, maximo: number) =>
  z.string().trim().min(1, `Escribe ${nombre}.`).max(maximo, `Máximo ${maximo} caracteres.`)
const plantilla = (nombre: string) => obligatorio(nombre, 60)

export const CAMPOS_PLANTILLA = [
  ['plantillaNumeroComprobante', 'N.° de comprobante · costo de ventas'],
  ['plantillaGlosa', 'Glosa · costo de ventas'],
  ['plantillaNumeroComprobanteMerma', 'N.° de comprobante · merma'],
  ['plantillaGlosaMerma', 'Glosa · merma'],
  ['plantillaNumeroComprobanteDesmedro', 'N.° de comprobante · desmedro'],
  ['plantillaGlosaDesmedro', 'Glosa · desmedro'],
  ['plantillaNumeroComprobanteAjuste', 'N.° de comprobante · ajuste'],
  ['plantillaGlosaAjuste', 'Glosa · ajuste'],
] as const

export const esquemaWinconta = z.object({
  subdiario: obligatorio('el subdiario', 10),
  tipoCp: obligatorio('el Tip.CP', 10),
  codigoCp: obligatorio('el Cod.CP', 20),
  razonSocial: obligatorio('la razón social', 100),
  tipoDocumento: obligatorio('el T.D.', 10),
  serie: z.string().trim().max(10, 'Máximo 10 caracteres.'),
  plantillaNumeroComprobante: plantilla('la plantilla'),
  plantillaGlosa: plantilla('la plantilla'),
  plantillaNumeroComprobanteMerma: plantilla('la plantilla'),
  plantillaGlosaMerma: plantilla('la plantilla'),
  plantillaNumeroComprobanteDesmedro: plantilla('la plantilla'),
  plantillaGlosaDesmedro: plantilla('la plantilla'),
  plantillaNumeroComprobanteAjuste: plantilla('la plantilla'),
  plantillaGlosaAjuste: plantilla('la plantilla'),
  moneda: z.enum(['S', 'D']),
})
export type FormularioWinconta = z.infer<typeof esquemaWinconta>

/** Todo menos `columnas` (19, fijo: formato de importación de WinConta). */
export function valoresWinconta({ winconta: w }: Configuracion): FormularioWinconta {
  return {
    subdiario: w.subdiario, tipoCp: w.tipoCp, codigoCp: w.codigoCp, razonSocial: w.razonSocial,
    tipoDocumento: w.tipoDocumento, serie: w.serie,
    plantillaNumeroComprobante: w.plantillaNumeroComprobante, plantillaGlosa: w.plantillaGlosa,
    plantillaNumeroComprobanteMerma: w.plantillaNumeroComprobanteMerma, plantillaGlosaMerma: w.plantillaGlosaMerma,
    plantillaNumeroComprobanteDesmedro: w.plantillaNumeroComprobanteDesmedro, plantillaGlosaDesmedro: w.plantillaGlosaDesmedro,
    plantillaNumeroComprobanteAjuste: w.plantillaNumeroComprobanteAjuste, plantillaGlosaAjuste: w.plantillaGlosaAjuste,
    moneda: w.moneda,
  }
}

export const cambiosWinconta = (d: FormularioWinconta): CambiosConfiguracion => ({ winconta: d })

// ---- Toma de inventario (solo ADMIN) ----------------------------------------------------------------------------
export const esquemaToma = z.object({
  obligatoria: z.boolean(),
  recordarDesdeMes: entero('Mes del recordatorio', 1, 12),
  toleranciaDiferenciaTn: z.string().trim().regex(/^\d+(\.\d{1,4})?$/, 'Escribe la tolerancia en TN (hasta 4 decimales).'),
})
export type FormularioToma = z.infer<typeof esquemaToma>

export const valoresToma = ({ tomaInventario: t }: Configuracion): FormularioToma => ({
  obligatoria: t.obligatoria,
  recordarDesdeMes: texto(t.recordarDesdeMes),
  toleranciaDiferenciaTn: t.toleranciaDiferenciaTn,
})

export const cambiosToma = (d: FormularioToma): CambiosConfiguracion => ({
  tomaInventario: { obligatoria: d.obligatoria, recordarDesdeMes: aEntero(d.recordarDesdeMes), toleranciaDiferenciaTn: d.toleranciaDiferenciaTn },
})
