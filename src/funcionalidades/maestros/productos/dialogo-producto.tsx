// Alta y edición de producto (docs/UI-UX.md §5.16). El código no se edita después de crear; Tablas 5, 6 y 14
// salen de /catalogos (Tabla 14: solo 1, promedio ponderado).
import { useId, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { aCrear, aEditar, CAMPOS_PRODUCTO, esquemaProducto, METODO_PROMEDIO, valoresIniciales, type FormularioProducto } from './esquemas'
import { useCatalogos, type ItemCatalogo } from '@/api/catalogos'
import { CLAVES } from '@/api/claves'
import { crearProducto, editarProducto, type Producto } from '@/api/productos'
import { Campo } from '@/componentes/comunes/campo'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { CampoSelect, type OpcionSelect } from '@/componentes/comunes/campo-select'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Input } from '@/componentes/ui/input'
import { codigoDeError, mensajeDeError } from '@/lib/errores'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  producto?: Producto
  focoAlCerrar?: RefObject<HTMLElement | null>
}

/** Opciones de una tabla SUNAT; si el valor actual no está en el catálogo, igual se muestra. */
function opcionesDe(items: readonly ItemCatalogo[] | undefined, actual: string): OpcionSelect[] {
  const opciones = (items ?? []).map((item) => ({ valor: item.codigo, texto: `${item.codigo} · ${item.descripcion}` }))
  if (actual && !opciones.some((o) => o.valor === actual)) opciones.unshift({ valor: actual, texto: actual })
  return opciones
}

export function DialogoProducto({ abierto, alCambiarAbierto, producto, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const catalogos = useCatalogos()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  // Quien lo usa le cambia la `key` en cada apertura: el formulario nace con los valores del producto.
  const { register, handleSubmit, control, setError, getValues, formState: { errors } } = useForm<FormularioProducto>({
    resolver: zodResolver(esquemaProducto),
    defaultValues: valoresIniciales(producto),
  })

  const guardar = useMutation({
    mutationFn: (datos: FormularioProducto) => (producto ? editarProducto(producto.id, aEditar(datos, producto)) : crearProducto(aCrear(datos))),
    onSuccess: (guardado) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.productos })
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.stock })
      toast.success(producto ? `Producto ${guardado.codigo} actualizado` : `Producto ${guardado.codigo} registrado`)
      alCambiarAbierto(false)
    },
    onError: (error) => {
      if (codigoDeError(error) === 'PRODUCTO_DUPLICADO') {
        setError('codigo', { type: 'api', message: mensajeDeError(error) }, { shouldFocus: true })
        setErrorEnvio(null)
        return
      }
      setErrorEnvio(aplicarErrorDeApi(error, setError, CAMPOS_PRODUCTO))
    },
  })

  const enviar = handleSubmit((datos) => {
    setErrorEnvio(null)
    guardar.mutate(datos)
  })

  const metodos = opcionesDe(catalogos.data?.metodosValuacion, METODO_PROMEDIO).map((o) => ({
    ...o,
    deshabilitada: o.valor !== METODO_PROMEDIO,
  }))

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={producto ? `Editar producto ${producto.codigo}` : 'Nuevo producto'}
      alEnviar={enviar}
      enviando={guardar.isPending}
      errorEnvio={errorEnvio}
      focoAlCerrar={focoAlCerrar}
      amplio
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id={`${id}-codigo`}
          etiqueta="Código"
          error={errors.codigo?.message}
          ayuda={producto ? 'El código no se edita después de crear.' : 'Letras, dígitos y guion. No se podrá cambiar.'}
        >
          {(a) => (
            <Input {...a} readOnly={!!producto} aria-readonly={!!producto || undefined} autoComplete="off"
              className="h-9 font-mono uppercase read-only:bg-muted" {...register('codigo')} />
          )}
        </Campo>
        <Campo id={`${id}-libro`} etiqueta="Código del libro 12.1" error={errors.codigoLibro?.message}>
          {(a) => <Input {...a} autoComplete="off" className="h-9 font-mono" {...register('codigoLibro')} />}
        </Campo>
        <Campo id={`${id}-descripcion`} etiqueta="Descripción" error={errors.descripcion?.message} className="sm:col-span-2">
          {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('descripcion')} />}
        </Campo>
        <Campo id={`${id}-tabla5`} etiqueta="Tipo de existencia (Tabla 5)" error={errors.tipoExistencia?.message}>
          {(a) => <CampoSelect {...a} opciones={opcionesDe(catalogos.data?.tiposExistencia, getValues('tipoExistencia'))} {...register('tipoExistencia')} />}
        </Campo>
        <Campo id={`${id}-tabla6`} etiqueta="Unidad de medida (Tabla 6)" error={errors.unidadMedida?.message}>
          {(a) => <CampoSelect {...a} opciones={opcionesDe(catalogos.data?.unidadesMedida, getValues('unidadMedida'))} {...register('unidadMedida')} />}
        </Campo>
        <Campo id={`${id}-tabla14`} etiqueta="Método de valuación (Tabla 14)" error={errors.metodoValuacion?.message}
          ayuda="El sistema calcula solo el promedio ponderado.">
          {(a) => <CampoSelect {...a} opciones={metodos} {...register('metodoValuacion')} />}
        </Campo>
        <Campo id={`${id}-denominacion`} etiqueta="Denominación contable" error={errors.denominacionContable?.message}>
          {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('denominacionContable')} />}
        </Campo>
        <Campo id={`${id}-cta-inv`} etiqueta="Cuenta de existencias" error={errors.cuentaInventario?.message} ayuda="De 2 a 12 dígitos.">
          {(a) => <Input {...a} inputMode="numeric" autoComplete="off" className="h-9 font-mono" {...register('cuentaInventario')} />}
        </Campo>
        <Campo id={`${id}-cta-cv`} etiqueta="Cuenta de costo de ventas" error={errors.cuentaCostoVentas?.message} ayuda="De 2 a 12 dígitos.">
          {(a) => <Input {...a} inputMode="numeric" autoComplete="off" className="h-9 font-mono" {...register('cuentaCostoVentas')} />}
        </Campo>
      </div>
      {producto && (
        <Controller
          control={control}
          name="activo"
          render={({ field }) => (
            <CampoCasilla id={`${id}-activo`} etiqueta="Activo" ref={field.ref} marcado={field.value} alCambiar={field.onChange} />
          )}
        />
      )}
    </DialogoFormulario>
  )
}
