// Formulario de producto (docs/UI-UX.md §5.16). La API valida las Tablas SUNAT y las cuentas; aquí, la forma.
import { z } from 'zod'
import type { DatosCrearProducto, DatosEditarProducto, Producto } from '@/api/productos'

/** Tabla 14: el sistema solo calcula el promedio ponderado (código 1). */
export const METODO_PROMEDIO = '1'

const cuenta = (nombre: string) =>
  z.string().trim().regex(/^\d{2,12}$/, `La cuenta de ${nombre} tiene de 2 a 12 dígitos.`)

export const esquemaProducto = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Escribe el código del producto.')
    .max(20, 'Máximo 20 caracteres.')
    .regex(/^[A-Z0-9-]+$/, 'Usa solo letras, dígitos y guion.'),
  codigoLibro: z.string().trim().min(1, 'Escribe el código del libro 12.1.').max(24, 'Máximo 24 caracteres.'),
  descripcion: z.string().trim().min(1, 'Escribe la descripción.').max(150, 'Máximo 150 caracteres.'),
  tipoExistencia: z.string().min(1, 'Elige el tipo de existencia (Tabla 5).'),
  unidadMedida: z.string().min(1, 'Elige la unidad de medida (Tabla 6).'),
  metodoValuacion: z.literal(METODO_PROMEDIO, { message: 'El sistema solo calcula el promedio ponderado (1).' }),
  cuentaInventario: cuenta('existencias'),
  cuentaCostoVentas: cuenta('costo de ventas'),
  denominacionContable: z.string().trim().min(1, 'Escribe la denominación contable.').max(100, 'Máximo 100 caracteres.'),
  activo: z.boolean(),
})

export type FormularioProducto = z.infer<typeof esquemaProducto>

export const CAMPOS_PRODUCTO = Object.keys(esquemaProducto.shape) as (keyof FormularioProducto)[]

export function valoresIniciales(producto?: Producto): FormularioProducto {
  if (producto) {
    return {
      codigo: producto.codigo,
      codigoLibro: producto.codigoLibro,
      descripcion: producto.descripcion,
      tipoExistencia: producto.tipoExistencia,
      unidadMedida: producto.unidadMedida,
      metodoValuacion: METODO_PROMEDIO,
      cuentaInventario: producto.cuentaInventario,
      cuentaCostoVentas: producto.cuentaCostoVentas,
      denominacionContable: producto.denominacionContable,
      activo: producto.activo,
    }
  }
  return {
    codigo: '', codigoLibro: '', descripcion: '', tipoExistencia: '01', unidadMedida: 'TNE',
    metodoValuacion: METODO_PROMEDIO, cuentaInventario: '', cuentaCostoVentas: '', denominacionContable: '', activo: true,
  }
}

export function aCrear(datos: FormularioProducto): DatosCrearProducto {
  return {
    codigo: datos.codigo,
    codigoLibro: datos.codigoLibro,
    descripcion: datos.descripcion,
    tipoExistencia: datos.tipoExistencia,
    unidadMedida: datos.unidadMedida,
    metodoValuacion: datos.metodoValuacion,
    cuentaInventario: datos.cuentaInventario,
    cuentaCostoVentas: datos.cuentaCostoVentas,
    denominacionContable: datos.denominacionContable,
  }
}

/** Solo lo que cambió (la API valida códigos SUNAT y cuentas solo si cambian). El código nunca se envía. */
export function aEditar(datos: FormularioProducto, original: Producto): DatosEditarProducto {
  const cambios: DatosEditarProducto = {}
  const campos = [
    'codigoLibro', 'descripcion', 'tipoExistencia', 'unidadMedida', 'metodoValuacion', 'cuentaInventario',
    'cuentaCostoVentas', 'denominacionContable',
  ] as const
  for (const campo of campos) {
    if (datos[campo] !== original[campo]) cambios[campo] = datos[campo]
  }
  if (datos.activo !== original.activo) cambios.activo = datos.activo
  return cambios
}
