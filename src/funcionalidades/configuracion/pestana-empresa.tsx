// Pestaña Empresa (docs/UI-UX.md §5.17): RUC y razón social vienen de la semilla (siempre solo lectura);
// política de stock negativo, redondeo del SI y asiento de merma: solo ADMIN.
import { useEffect, useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cambiosEmpresa, esquemaEmpresa, valoresEmpresa, type FormularioEmpresa } from './esquemas'
import { FormularioSeccion } from './formulario-seccion'
import { useGuardarSeccion } from './use-guardar-seccion'
import type { Configuracion } from '@/api/configuracion'
import { Campo } from '@/componentes/comunes/campo'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { Input } from '@/componentes/ui/input'

export function PestanaEmpresa({ configuracion, editable }: { configuracion: Configuracion; editable: boolean }) {
  const id = useId()
  const guardar = useGuardarSeccion('la empresa')
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormularioEmpresa>({
    resolver: zodResolver(esquemaEmpresa),
    defaultValues: valoresEmpresa(configuracion),
  })
  // Tras guardar (esta u otra pestaña) llega la configuración nueva: se conserva lo que se está editando.
  useEffect(() => reset(valoresEmpresa(configuracion), { keepDirtyValues: true }), [configuracion, reset])

  return (
    <FormularioSeccion
      titulo="Empresa"
      descripcion="Datos de la empresa y reglas generales del inventario."
      editable={editable}
      quienEdita="el administrador"
      alEnviar={handleSubmit((d) => guardar.mutate(cambiosEmpresa(d)))}
      enviando={guardar.isPending}
      error={guardar.error}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-3 text-sm">
        <dt className="text-muted-foreground">RUC</dt>
        <dd className="font-mono">{configuracion.empresa.ruc}</dd>
        <dt className="text-muted-foreground">Razón social</dt>
        <dd>{configuracion.empresa.razonSocial}</dd>
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${id}-politica`} etiqueta="Política de stock negativo" error={errors.politicaStockNegativo?.message}
          ayuda="Con «Permitir con alerta» la salida se registra si el usuario la confirma; con «Bloquear» no.">
          {(a) => (
            <CampoSelect {...a} opciones={[
              { valor: 'PERMITIR_CON_ALERTA', texto: 'Permitir con alerta' },
              { valor: 'BLOQUEAR', texto: 'Bloquear' },
            ]} {...register('politicaStockNegativo')} />
          )}
        </Campo>
        <Campo id={`${id}-redondeo`} etiqueta="Decimales del costo del saldo inicial (cierre anual)" error={errors.decimalesRedondeoSiCosto?.message}
          ayuda="De 0 a 6.">
          {(a) => <Input {...a} inputMode="numeric" className="h-9 w-24 text-right tabular-nums" {...register('decimalesRedondeoSiCosto')} />}
        </Campo>
      </div>
      <Controller control={control} name="mermaEnAsientoSeparado" render={({ field }) => (
        <CampoCasilla id={`${id}-merma`} etiqueta="Merma en un asiento aparte del costo de ventas" ref={field.ref}
          marcado={field.value} alCambiar={field.onChange} deshabilitado={!editable} />
      )} />
    </FormularioSeccion>
  )
}
