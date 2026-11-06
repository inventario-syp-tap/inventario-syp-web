// Pestaña WinConta (docs/UI-UX.md §5.17, ADMIN y CONTADOR): datos del asiento y plantillas de número y glosa.
// El formato de importación tiene 19 columnas fijas (no se edita).
import { useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CAMPOS_PLANTILLA, cambiosWinconta, esquemaWinconta, valoresWinconta, type FormularioWinconta } from './esquemas'
import { FormularioSeccion } from './formulario-seccion'
import { useGuardarSeccion } from './use-guardar-seccion'
import type { Configuracion } from '@/api/configuracion'
import { Campo } from '@/componentes/comunes/campo'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { Input } from '@/componentes/ui/input'

type CampoTexto = Exclude<keyof FormularioWinconta, 'moneda'>

export function PestanaWinconta({ configuracion, editable }: { configuracion: Configuracion; editable: boolean }) {
  const id = useId()
  const guardar = useGuardarSeccion('WinConta')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormularioWinconta>({
    resolver: zodResolver(esquemaWinconta),
    defaultValues: valoresWinconta(configuracion),
  })
  // Tras guardar (esta u otra pestaña) llega la configuración nueva: se conserva lo que se está editando.
  useEffect(() => reset(valoresWinconta(configuracion), { keepDirtyValues: true }), [configuracion, reset])

  const campo = (nombre: CampoTexto, etiqueta: string, clase = 'h-9 font-mono', ayuda?: string) => (
    <Campo id={`${id}-${nombre}`} etiqueta={etiqueta} error={errors[nombre]?.message} ayuda={ayuda}>
      {(a) => <Input {...a} autoComplete="off" className={clase} {...register(nombre)} />}
    </Campo>
  )

  return (
    <FormularioSeccion
      titulo="WinConta"
      descripcion={`Exportación del asiento a WinConta: formato de ${configuracion.winconta.columnas} columnas (fijo).`}
      editable={editable}
      quienEdita="el administrador o la contadora"
      alEnviar={handleSubmit((d) => guardar.mutate(cambiosWinconta(d)))}
      enviando={guardar.isPending}
      error={guardar.error}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {campo('subdiario', 'Subdiario')}
        {campo('tipoCp', 'Tip.CP')}
        {campo('codigoCp', 'Cod.CP')}
        {campo('tipoDocumento', 'T.D.')}
        {campo('serie', 'Serie (opcional)')}
        <Campo id={`${id}-moneda`} etiqueta="Moneda" error={errors.moneda?.message}>
          {(a) => <CampoSelect {...a} opciones={[{ valor: 'S', texto: 'S · Soles' }, { valor: 'D', texto: 'D · Dólares' }]} {...register('moneda')} />}
        </Campo>
        <div className="sm:col-span-3">{campo('razonSocial', 'Razón social del asiento', 'h-9')}</div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Plantillas</legend>
        <p className="text-xs text-muted-foreground">
          Marcadores: <code className="font-mono">{'{MM}'}</code> mes en 2 dígitos, <code className="font-mono">{'{MES}'}</code> nombre
          del mes y <code className="font-mono">{'{AAAA}'}</code> año. Máximo 60 caracteres.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS_PLANTILLA.map(([nombre, etiqueta]) => <div key={nombre}>{campo(nombre, etiqueta)}</div>)}
        </div>
      </fieldset>
    </FormularioSeccion>
  )
}
