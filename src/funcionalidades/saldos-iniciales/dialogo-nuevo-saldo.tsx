// Nuevo saldo inicial manual (A, C; POST /saldos-iniciales) para un producto y año SIN saldo: producto, cantidad y
// costo total como texto y motivo obligatorio. Stock negativo → DialogoStockNegativo y reenvío con la confirmación.
// 409 SALDO_INICIAL_YA_EXISTE (otro usuario lo creó antes): se avisa junto al producto y se recarga la tabla para
// que aparezca con su botón «Editar».
import { useId, useState, type RefObject } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { esquemaNuevoSaldoInicial, type FormularioNuevoSaldoInicial } from './esquemas'
import { CLAVES } from '@/api/claves'
import { textoProducto, type Producto } from '@/api/productos'
import { crearSaldoInicial, type DatosCrearSaldoInicial, type SaldoInicial } from '@/api/saldos-iniciales'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { Campo } from '@/componentes/comunes/campo'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { MAXIMO_MOTIVO } from '@/componentes/comunes/dialogo-confirmacion'
import { DialogoStockNegativo } from '@/componentes/comunes/dialogo-stock-negativo'
import { Textarea } from '@/componentes/ui/textarea'
import { useEscritura } from '@/funcionalidades/comprobantes/use-escritura'
import { codigoDeError, mensajeDeError } from '@/lib/errores'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  anio: number
  /** Productos que aún no tienen saldo inicial en `anio`. */
  productos: readonly Producto[]
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoNuevoSaldo({ anio, productos, abierto, alCambiarAbierto, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const { control, register, handleSubmit, setError, setValue, formState: { errors } } = useForm<FormularioNuevoSaldoInicial>({
    resolver: zodResolver(esquemaNuevoSaldoInicial),
    defaultValues: { productoId: '', cantidad: '', costoTotal: '', motivo: '' },
  })
  const productoId = useWatch({ control, name: 'productoId' })
  const productoElegido = productos.find((p) => String(p.id) === productoId)

  const escritura = useEscritura<DatosCrearSaldoInicial, SaldoInicial>({
    ejecutar: crearSaldoInicial,
    alExito: (saldo) => {
      toast.success(`Saldo inicial ${saldo.anio} de ${saldo.productoCodigo} registrado · kardex recalculado`)
      alCambiarAbierto(false)
    },
    alError: (error) => {
      if (codigoDeError(error) === 'SALDO_INICIAL_YA_EXISTE') {
        // Ese producto deja de ofrecerse al recargar la tabla: se limpia para no reenviarlo (el mensaje se conserva).
        setValue('productoId', '')
        setError('productoId', { message: mensajeDeError(error) })
        setErrorEnvio(null)
        void clienteConsultas.invalidateQueries({ queryKey: CLAVES.saldosIniciales })
        return
      }
      setErrorEnvio(aplicarErrorDeApi(error, setError, ['productoId', 'cantidad', 'costoTotal', 'motivo']))
    },
  })

  return (
    <>
      <DialogoFormulario
        abierto={abierto}
        alCambiarAbierto={alCambiarAbierto}
        titulo={`Nuevo saldo inicial manual ${anio}`}
        descripcion={`Para un producto que aún no tiene saldo inicial en ${anio}. Queda con origen Manual y el sistema recalcula el kardex de ${anio}.`}
        alEnviar={handleSubmit((valores) => {
          setErrorEnvio(null)
          escritura.enviar({
            anio,
            productoId: Number.parseInt(valores.productoId, 10),
            cantidad: valores.cantidad,
            costoTotal: valores.costoTotal,
            motivo: valores.motivo,
          })
        })}
        enviando={escritura.enviando}
        errorEnvio={errorEnvio}
        focoAlCerrar={focoAlCerrar}
      >
        <Campo id={`${id}-producto`} etiqueta="Producto" error={errors.productoId?.message}
          ayuda={productos.length === 0 ? `Todos los productos ya tienen saldo inicial en ${anio}: edítalos desde la tabla.` : undefined}>
          {(a) => (
            <CampoSelect {...a} {...register('productoId')} vacio="Elige un producto"
              opciones={productos.map((p) => ({ valor: String(p.id), texto: textoProducto(p) }))} />
          )}
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller control={control} name="cantidad" render={({ field }) => (
            <Campo id={`${id}-cantidad`} etiqueta="Cantidad TN" error={errors.cantidad?.message} ayuda="Hasta 4 decimales.">
              {(a) => <CampoDecimal {...a} ref={field.ref} name={field.name} decimales={4} valor={field.value} alCambiar={field.onChange} onBlur={field.onBlur} className="h-9" />}
            </Campo>
          )} />
          <Controller control={control} name="costoTotal" render={({ field }) => (
            <Campo id={`${id}-costo`} etiqueta="Costo total S/" error={errors.costoTotal?.message} ayuda="Hasta 10 decimales.">
              {(a) => <CampoDecimal {...a} ref={field.ref} name={field.name} decimales={10} valor={field.value} alCambiar={field.onChange} onBlur={field.onBlur} className="h-9" />}
            </Campo>
          )} />
        </div>
        <Campo id={`${id}-motivo`} etiqueta="Motivo" error={errors.motivo?.message} ayuda="Queda en la auditoría.">
          {(a) => <Textarea {...a} rows={3} maxLength={MAXIMO_MOTIVO} {...register('motivo')} />}
        </Campo>
        {escritura.hayConflicto && <AvisoConflicto alReintentar={escritura.recargar} />}
      </DialogoFormulario>
      <DialogoStockNegativo
        abierto={escritura.confirmacion !== null}
        alCambiarAbierto={(siguiente) => { if (!siguiente) escritura.cancelarConfirmacion() }}
        detalle={escritura.confirmacion}
        producto={productoElegido ? textoProducto(productoElegido) : 'el producto'}
        alConfirmar={escritura.confirmar}
      />
    </>
  )
}
