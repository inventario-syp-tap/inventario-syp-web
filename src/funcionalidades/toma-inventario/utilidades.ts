// Utilidades de la toma de inventario sin componentes: pasos del asistente, textos de las acciones y los datos para
// «Volver a calcular» una toma desactualizada.
import type { DatosCrearToma, Toma } from '@/api/tomas-inventario'

export const PASOS = ['Fecha y responsable', 'Cantidades contadas', 'Diferencias', 'Acciones y cierre'] as const

export const TEXTO_ACCION = { MERMA: 'Merma (13)', AJUSTE: 'Ajuste (28)', NINGUNA: 'Ninguna' } as const

/** «Volver a calcular»: una toma nueva con la misma fecha, establecimiento, responsable, observación y cantidades. */
export function datosParaRecalcular(toma: Toma): DatosCrearToma {
  return {
    fecha: toma.fecha,
    establecimientoId: toma.establecimientoId,
    responsable: toma.responsable,
    ...(toma.observacion ? { observacion: toma.observacion } : {}),
    lineas: toma.lineas.map((l) => ({ productoId: l.productoId, cantidadContada: l.cantidadContada })),
  }
}
