// «Exportar a WinConta» (A, C; docs/UI-UX.md §5.13): número de asiento (4 dígitos) y tipo de cambio (3 decimales),
// validados con zod antes de enviar. Descarga el .xlsx con el mismo manejo de descargas del S10 (sesión,
// "Despertando el servidor…", límite por minuto) y la API registra la exportación en el historial.
// Errores: 409 PERIODO_NO_CERRADO, 422 REGLA_CONTABLE_FALTANTE y ASIENTO_VACIO con mensaje propio (y se recargan los
// asientos, porque cambiaron), 400 VALIDACION junto a su campo y 409 CONFLICTO_CONCURRENTE con AvisoConflicto.
import { useId, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { esquemaExportarWinConta, type FormularioExportarWinConta } from './esquemas'
import { mensajeDeExportacion } from './mensajes'
import { exportarWinConta, NOMBRE_TIPO_ASIENTO, type Asiento, type DatosExportarWinConta } from '@/api/asientos'
import { CLAVES } from '@/api/claves'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { Campo } from '@/componentes/comunes/campo'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Input } from '@/componentes/ui/input'
import { codigoDeError, esConflicto } from '@/lib/errores'
import { formatearPeriodo } from '@/lib/formato'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  anio: number
  mes: number
  asiento: Asiento
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoExportarWinConta({ anio, mes, asiento, abierto, alCambiarAbierto, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [conflicto, setConflicto] = useState(false)
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<FormularioExportarWinConta>({
    resolver: zodResolver(esquemaExportarWinConta),
    defaultValues: { numeroAsiento: asiento.exportacion.numeroAsiento ?? '', tipoCambio: '' },
  })
  const nombreTipo = NOMBRE_TIPO_ASIENTO[asiento.tipoAsiento]
  const periodo = formatearPeriodo(anio, mes)

  const recargar = () => {
    void clienteConsultas.invalidateQueries({ queryKey: CLAVES.asientos })
    void clienteConsultas.invalidateQueries({ queryKey: CLAVES.periodos })
    void clienteConsultas.invalidateQueries({ queryKey: CLAVES.dashboard })
  }

  const exportacion = useMutation({
    mutationFn: (datos: DatosExportarWinConta) => exportarWinConta(datos),
    onSuccess: (nombre) => {
      toast.success(`Asiento de ${nombreTipo.toLowerCase()} de ${periodo} exportado · descarga lista: ${nombre}`)
      recargar()
      alCambiarAbierto(false)
    },
    onError: (error) => {
      if (esConflicto(error)) {
        setConflicto(true)
        return
      }
      const codigo = codigoDeError(error)
      // El asiento cambió (mes reabierto, regla cerrada, movimientos anulados): la pantalla se pone al día.
      if (codigo === 'PERIODO_NO_CERRADO' || codigo === 'REGLA_CONTABLE_FALTANTE' || codigo === 'ASIENTO_VACIO') recargar()
      if (codigo === 'VALIDACION') {
        setErrorEnvio(aplicarErrorDeApi(error, setError, ['numeroAsiento', 'tipoCambio']))
        return
      }
      setErrorEnvio(mensajeDeExportacion(error))
    },
  })

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={`Exportar a WinConta · ${nombreTipo} · ${periodo}`}
      descripcion={`${asiento.glosa}. Se descarga el archivo .xlsx para importarlo en WinConta y la exportación queda en el historial.`}
      alEnviar={handleSubmit((valores) => {
        setErrorEnvio(null)
        setConflicto(false)
        exportacion.mutate({
          anio, mes, tipoAsiento: asiento.tipoAsiento, numeroAsiento: valores.numeroAsiento.trim(), tipoCambio: valores.tipoCambio.trim(),
        })
      })}
      enviando={exportacion.isPending}
      errorEnvio={errorEnvio}
      textoGuardar="Exportar y descargar"
      focoAlCerrar={focoAlCerrar}
    >
      <Campo id={`${id}-numero`} etiqueta="N.° de asiento" error={errors.numeroAsiento?.message}
        ayuda="Exactamente 4 dígitos, como en WinConta (por ejemplo, 0001).">
        {(a) => (
          <Input {...a} {...register('numeroAsiento')} inputMode="numeric" autoComplete="off" maxLength={4}
            className="w-28 font-mono tabular-nums" />
        )}
      </Campo>
      <Controller control={control} name="tipoCambio" render={({ field }) => (
        <Campo id={`${id}-tc`} etiqueta="Tipo de cambio" error={errors.tipoCambio?.message}
          ayuda="Mayor que 0, hasta 3 decimales (por ejemplo, 3.750).">
          {(a) => (
            <CampoDecimal {...a} ref={field.ref} name={field.name} decimales={3} valor={field.value}
              alCambiar={field.onChange} onBlur={field.onBlur} className="h-9 w-32" />
          )}
        </Campo>
      )} />
      {conflicto && <AvisoConflicto alReintentar={() => { setConflicto(false); recargar() }} />}
    </DialogoFormulario>
  )
}
