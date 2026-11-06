// Editar o cerrar una regla contable (docs/UI-UX.md §5.16). Las reglas no se borran:
//  - editar: solo vigente hasta (vacío = reabrir sin fin), decisión y descripción;
//  - cerrar: solo vigente hasta (obligatorio).
// Lo demás se muestra en solo lectura. Si la vigencia se cruza con otra regla, 409 VIGENCIA_SUPERPUESTA.
import { useId, useMemo, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  aEditar, CAMPOS_EDITAR_REGLA, esquemaCerrarRegla, esquemaEditarRegla, formatearMes, NOMBRE_TIPO_ASIENTO,
  type FormularioEditarRegla,
} from './esquemas'
import { ReglasEnConflicto } from './reglas-en-conflicto'
import { CLAVES } from '@/api/claves'
import { editarRegla, type ReglaContable } from '@/api/reglas-contables'
import { Campo } from '@/componentes/comunes/campo'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Input } from '@/componentes/ui/input'
import { codigoDeError } from '@/lib/errores'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  regla: ReglaContable
  /** true: "Cerrar regla" (solo vigente hasta). */
  soloCerrar?: boolean
  reglas: readonly ReglaContable[]
  focoAlCerrar?: RefObject<HTMLElement | null>
}

const valores = (regla: ReglaContable): FormularioEditarRegla => ({
  vigenteHasta: regla.vigenteHasta ?? '',
  decision: regla.decision,
  descripcion: regla.descripcion,
})

export function DialogoEditarRegla({ abierto, alCambiarAbierto, regla, soloCerrar = false, reglas, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [conflicto, setConflicto] = useState<string | null | undefined>(undefined)

  // Al cerrar se valida solo "vigente hasta"; decisión y descripción quedan como estaban.
  const esquema = useMemo(
    () => (soloCerrar ? esquemaCerrarRegla(regla.vigenteDesde) : esquemaEditarRegla(regla.vigenteDesde)),
    [soloCerrar, regla.vigenteDesde],
  )
  // La página le cambia la `key` en cada apertura: el formulario nace con los valores de la regla.
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormularioEditarRegla>({
    resolver: zodResolver(esquema),
    defaultValues: valores(regla),
  })

  const guardar = useMutation({
    mutationFn: (datos: FormularioEditarRegla) => editarRegla(regla.id, aEditar(datos, regla)),
    onSuccess: (guardada) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.reglas })
      toast.success(soloCerrar ? `Regla ${guardada.codigo} cerrada hasta ${formatearMes(guardada.vigenteHasta)}` : `Regla ${guardada.codigo} actualizada`)
      alCambiarAbierto(false)
    },
    onError: (error, datos) => {
      setConflicto(codigoDeError(error) === 'VIGENCIA_SUPERPUESTA' ? (datos.vigenteHasta || null) : undefined)
      setErrorEnvio(aplicarErrorDeApi(error, setError, CAMPOS_EDITAR_REGLA))
    },
  })

  const enviar = handleSubmit((datos) => {
    setErrorEnvio(null)
    setConflicto(undefined)
    if (Object.keys(aEditar(datos, regla)).length === 0) {
      alCambiarAbierto(false)
      return
    }
    guardar.mutate(datos)
  })

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={soloCerrar ? `Cerrar la regla ${regla.codigo}` : `Editar la regla ${regla.codigo}`}
      descripcion={soloCerrar
        ? 'La regla no se borra: deja de aplicarse después del mes que indiques.'
        : 'Tipo, producto, operación y cuentas no se cambian. Para otras cuentas, cierra esta regla y crea una nueva.'}
      textoGuardar={soloCerrar ? 'Cerrar regla' : 'Guardar'}
      alEnviar={enviar}
      enviando={guardar.isPending}
      errorEnvio={errorEnvio}
      detalleError={conflicto !== undefined && (
        <ReglasEnConflicto
          reglas={reglas}
          tipoAsiento={regla.tipoAsiento}
          productoId={regla.productoId}
          tipoOperacion={regla.tipoOperacion}
          vigenteDesde={regla.vigenteDesde}
          vigenteHasta={conflicto}
          excluirId={regla.id}
        />
      )}
      focoAlCerrar={focoAlCerrar}
      amplio={!soloCerrar}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-3 text-sm">
        <dt className="text-muted-foreground">Tipo</dt><dd>{NOMBRE_TIPO_ASIENTO[regla.tipoAsiento]}</dd>
        <dt className="text-muted-foreground">Producto</dt><dd className="font-mono">{regla.productoCodigo}</dd>
        <dt className="text-muted-foreground">Operación</dt><dd className="font-mono">{regla.tipoOperacion}</dd>
        <dt className="text-muted-foreground">Debe · Haber</dt><dd className="font-mono">{regla.cuentaDebe} · {regla.cuentaHaber}</dd>
        <dt className="text-muted-foreground">Vigente desde</dt><dd>{formatearMes(regla.vigenteDesde)} <span className="font-mono">({regla.vigenteDesde})</span></dd>
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          id={`${id}-hasta`}
          etiqueta={soloCerrar ? 'Vigente hasta (AAAA-MM)' : 'Vigente hasta (AAAA-MM, opcional)'}
          error={errors.vigenteHasta?.message}
          ayuda={soloCerrar ? 'Último mes en que se aplica (incluido).' : 'Vacío = sin fin (reabre la regla).'}
        >
          {(a) => <Input {...a} placeholder={soloCerrar ? '2026-12' : 'sin fin'} inputMode="numeric" maxLength={7} autoComplete="off" className="h-9 font-mono" {...register('vigenteHasta')} />}
        </Campo>
        {!soloCerrar && (
          <>
            <Campo id={`${id}-decision`} etiqueta="Decisión (sustento)" error={errors.decision?.message}>
              {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('decision')} />}
            </Campo>
            <Campo id={`${id}-descripcion`} etiqueta="Descripción" error={errors.descripcion?.message} className="sm:col-span-2">
              {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('descripcion')} />}
            </Campo>
          </>
        )}
      </div>
    </DialogoFormulario>
  )
}
