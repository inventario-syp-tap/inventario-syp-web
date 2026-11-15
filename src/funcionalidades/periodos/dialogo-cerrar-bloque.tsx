// Cerrar en bloque (solo ADMIN, docs/UI-UX.md §5.9): desde–hasta (AAAA-MM, inclusive) y una confirmación que repite
// el rango antes de enviar. Si la API rechaza por saldo cero con costo, se listan los movimientos.
import { useId, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { esquemaBloque, type FormularioBloque } from './esquemas'
import { ListaMovimientos } from './lista-movimientos'
import { leerMovimientosSaldoCero } from './saldo-cero'
import { invalidarTrasEscritura } from '@/api/claves'
import { cerrarEnBloque, type DatosCerrarEnBloque, type ResultadoBloque } from '@/api/periodos'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { Campo } from '@/componentes/comunes/campo'
import { DialogoConfirmacion } from '@/componentes/comunes/dialogo-confirmacion'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Input } from '@/componentes/ui/input'
import { codigoDeError, esConflicto, mensajeDeError } from '@/lib/errores'
import { textoAnioMes } from '@/lib/periodos'

type Props = {
  anio: number
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
  alCerrar: (resultado: ResultadoBloque) => void
}

export function DialogoCerrarBloque({ anio, abierto, alCambiarAbierto, focoAlCerrar, alCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [porConfirmar, setPorConfirmar] = useState<DatosCerrarEnBloque | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<FormularioBloque>({
    resolver: zodResolver(esquemaBloque),
    defaultValues: { desde: `${anio}-01`, hasta: `${anio}-12` },
  })
  const cerrar = useMutation({
    mutationFn: cerrarEnBloque,
    onSuccess: (resultado) => {
      invalidarTrasEscritura(clienteConsultas)
      alCambiarAbierto(false)
      alCerrar(resultado)
    },
  })
  const conflicto = cerrar.isError && esConflicto(cerrar.error)
  const saldoCero = codigoDeError(cerrar.error) === 'CIERRE_CON_SALDO_CERO_CON_COSTO'

  return (
    <>
      <DialogoFormulario
        abierto={abierto}
        alCambiarAbierto={alCambiarAbierto}
        titulo="Cerrar en bloque"
        descripcion="Cierra en orden todos los meses abiertos del rango (para ponerse al día con los años anteriores)."
        alEnviar={handleSubmit((valores) => setPorConfirmar(valores))}
        enviando={cerrar.isPending}
        errorEnvio={cerrar.isError && !conflicto ? mensajeDeError(cerrar.error) : null}
        detalleError={saldoCero && (
          <ListaMovimientos movimientos={leerMovimientosSaldoCero(cerrar.error)} alerta="SALDO_CERO_CON_COSTO" anio={anio} mes={null}
            alNavegar={() => alCambiarAbierto(false)} />
        )}
        textoGuardar="Cerrar meses"
        focoAlCerrar={focoAlCerrar}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={`${id}-desde`} etiqueta="Desde" error={errors.desde?.message} ayuda="Mes y año (AAAA-MM).">
            {(a) => <Input {...a} type="month" placeholder="AAAA-MM" className="h-9 tabular-nums" {...register('desde')} />}
          </Campo>
          <Campo id={`${id}-hasta`} etiqueta="Hasta (inclusive)" error={errors.hasta?.message} ayuda="Mes y año (AAAA-MM).">
            {(a) => <Input {...a} type="month" placeholder="AAAA-MM" className="h-9 tabular-nums" {...register('hasta')} />}
          </Campo>
        </div>
        {conflicto && (
          <AvisoConflicto alReintentar={() => {
            cerrar.reset()
            invalidarTrasEscritura(clienteConsultas)
          }} />
        )}
      </DialogoFormulario>
      <DialogoConfirmacion
        abierto={porConfirmar !== null}
        alCambiarAbierto={(siguiente) => { if (!siguiente) setPorConfirmar(null) }}
        titulo="¿Cerrar todos esos meses?"
        descripcion={porConfirmar && `Se cerrarán los meses abiertos desde ${textoAnioMes(porConfirmar.desde)} hasta ${textoAnioMes(porConfirmar.hasta)}. Los saldos negativos no impiden el cierre; para corregir algo después habrá que reabrir mes por mes desde el último.`}
        textoConfirmar="Sí, cerrar"
        alConfirmar={() => {
          if (porConfirmar) cerrar.mutate(porConfirmar)
          setPorConfirmar(null)
        }}
      />
    </>
  )
}
