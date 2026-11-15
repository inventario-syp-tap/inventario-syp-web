// Editar un saldo inicial como MANUAL (A, C; PUT /saldos-iniciales/:id): cantidad y costo total como texto, motivo
// obligatorio. Si deja stock negativo en el año → DialogoStockNegativo y reenvío con la confirmación. Un conflicto
// muestra "Reintentar", que vuelve a cargar los datos sin reenviar.
import { useId, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { esquemaSaldoInicial, type FormularioSaldoInicial } from './esquemas'
import { editarSaldoInicial, type DatosEditarSaldoInicial, type SaldoInicial } from '@/api/saldos-iniciales'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { Campo } from '@/componentes/comunes/campo'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { MAXIMO_MOTIVO } from '@/componentes/comunes/dialogo-confirmacion'
import { DialogoStockNegativo } from '@/componentes/comunes/dialogo-stock-negativo'
import { Textarea } from '@/componentes/ui/textarea'
import { useEscritura } from '@/funcionalidades/comprobantes/use-escritura'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  saldo: SaldoInicial
  /** "FIERRO · Chatarra de fierro" */
  producto: string
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

/** "12.5000" → "12.5"; "13500.00" → "13500" (para editar sin ceros de relleno; sigue siendo texto). */
const sinCerosFinales = (valor: string) => (valor.includes('.') ? valor.replace(/\.?0+$/, '') : valor)

export function DialogoSaldoInicial({ saldo, producto, abierto, alCambiarAbierto, focoAlCerrar }: Props) {
  const id = useId()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<FormularioSaldoInicial>({
    resolver: zodResolver(esquemaSaldoInicial),
    defaultValues: { cantidad: sinCerosFinales(saldo.cantidad), costoTotal: sinCerosFinales(saldo.costoTotal), motivo: '' },
  })

  const escritura = useEscritura<DatosEditarSaldoInicial, SaldoInicial>({
    ejecutar: (cuerpo) => editarSaldoInicial(saldo.id, cuerpo),
    alExito: () => {
      toast.success(`Saldo inicial ${saldo.anio} de ${saldo.productoCodigo} actualizado · kardex recalculado`)
      alCambiarAbierto(false)
    },
    alError: (error) => setErrorEnvio(aplicarErrorDeApi(error, setError, ['cantidad', 'costoTotal', 'motivo'])),
  })

  return (
    <>
      <DialogoFormulario
        abierto={abierto}
        alCambiarAbierto={alCambiarAbierto}
        titulo={`Saldo inicial ${saldo.anio} · ${saldo.productoCodigo}`}
        descripcion={`${producto}. Al guardar queda con origen Manual y el sistema recalcula el kardex de ${saldo.anio}.`}
        alEnviar={handleSubmit((valores) => {
          setErrorEnvio(null)
          escritura.enviar({ cantidad: valores.cantidad, costoTotal: valores.costoTotal, motivo: valores.motivo })
        })}
        enviando={escritura.enviando}
        errorEnvio={errorEnvio}
        focoAlCerrar={focoAlCerrar}
      >
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
        producto={producto}
        alConfirmar={escritura.confirmar}
      />
    </>
  )
}
