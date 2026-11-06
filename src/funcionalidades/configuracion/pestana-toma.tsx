// Pestaña Toma de inventario (docs/UI-UX.md §5.17, solo ADMIN): recordatorio anual y tolerancia en TN.
import { useEffect, useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cambiosToma, esquemaToma, valoresToma, type FormularioToma } from './esquemas'
import { FormularioSeccion } from './formulario-seccion'
import { useGuardarSeccion } from './use-guardar-seccion'
import type { Configuracion } from '@/api/configuracion'
import { Campo } from '@/componentes/comunes/campo'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { nombreMes } from '@/lib/formato'

const MESES = Array.from({ length: 12 }, (_, i) => ({ valor: String(i + 1), texto: nombreMes(i + 1) }))

export function PestanaToma({ configuracion, editable }: { configuracion: Configuracion; editable: boolean }) {
  const id = useId()
  const guardar = useGuardarSeccion('la toma de inventario')
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormularioToma>({
    resolver: zodResolver(esquemaToma),
    defaultValues: valoresToma(configuracion),
  })
  // Tras guardar (esta u otra pestaña) llega la configuración nueva: se conserva lo que se está editando.
  useEffect(() => reset(valoresToma(configuracion), { keepDirtyValues: true }), [configuracion, reset])

  return (
    <FormularioSeccion
      titulo="Toma de inventario"
      descripcion="La toma de inventario es opcional; el dashboard la recuerda desde el mes indicado."
      editable={editable}
      quienEdita="el administrador"
      alEnviar={handleSubmit((d) => guardar.mutate(cambiosToma(d)))}
      enviando={guardar.isPending}
      error={guardar.error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${id}-mes`} etiqueta="Recordar desde" error={errors.recordarDesdeMes?.message}>
          {(a) => <CampoSelect {...a} opciones={MESES} {...register('recordarDesdeMes')} />}
        </Campo>
        <Controller control={control} name="toleranciaDiferenciaTn" render={({ field }) => (
          <Campo id={`${id}-tolerancia`} etiqueta="Tolerancia de diferencia (TN)" error={errors.toleranciaDiferenciaTn?.message}
            ayuda="Diferencias menores no se consideran faltante ni sobrante. Hasta 4 decimales.">
            {(a) => <CampoDecimal {...a} ref={field.ref} name={field.name} valor={field.value} alCambiar={field.onChange}
              onBlur={field.onBlur} decimales={4} className="h-9 w-40" />}
          </Campo>
        )} />
      </div>
      <Controller control={control} name="obligatoria" render={({ field }) => (
        <CampoCasilla id={`${id}-obligatoria`} etiqueta="Toma de inventario obligatoria" ref={field.ref}
          marcado={field.value} alCambiar={field.onChange} deshabilitado={!editable} />
      )} />
    </FormularioSeccion>
  )
}
