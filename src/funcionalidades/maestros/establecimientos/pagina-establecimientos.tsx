// Establecimientos (docs/UI-UX.md §5.16): todos ven la lista; solo ADMIN crea y edita
// (lib/roles.ts → 'establecimientos:editar'). El código no se edita; el texto del libro va en el encabezado del 12.1.
import { useId, useMemo, useState, type RefObject } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  aCrear, aEditar, CAMPOS_ESTABLECIMIENTO, esquemaEstablecimiento, textoLibroPorDefecto, valoresIniciales,
  type FormularioEstablecimiento,
} from './esquemas'
import { CLAVES } from '@/api/claves'
import {
  crearEstablecimiento, editarEstablecimiento, useEstablecimientos, type Establecimiento,
} from '@/api/establecimientos'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Campo } from '@/componentes/comunes/campo'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoActivo } from '@/componentes/comunes/estado-activo'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { useDialogo } from '@/hooks/use-dialogo'
import { codigoDeError, mensajeDeError } from '@/lib/errores'
import { aplicarErrorDeApi } from '@/lib/formularios'
import { usePuede } from '@/lib/roles'

type PropsDialogo = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  establecimiento?: Establecimiento
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoEstablecimiento({ abierto, alCambiarAbierto, establecimiento, focoAlCerrar }: PropsDialogo) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  // La página le cambia la `key` en cada apertura: el formulario nace limpio.
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm<FormularioEstablecimiento>({
    resolver: zodResolver(esquemaEstablecimiento),
    defaultValues: valoresIniciales(establecimiento),
  })

  const codigo = useWatch({ control, name: 'codigo' })
  const nombre = useWatch({ control, name: 'nombre' })

  const guardar = useMutation({
    mutationFn: (datos: FormularioEstablecimiento) => (establecimiento
      ? editarEstablecimiento(establecimiento.id, aEditar(datos, establecimiento))
      : crearEstablecimiento(aCrear(datos))),
    onSuccess: (guardado) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.establecimientos })
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.stock })
      toast.success(establecimiento ? `Establecimiento ${guardado.codigo} actualizado` : `Establecimiento ${guardado.codigo} registrado`)
      alCambiarAbierto(false)
    },
    onError: (error) => {
      if (codigoDeError(error) === 'ESTABLECIMIENTO_DUPLICADO') {
        setError('codigo', { type: 'api', message: mensajeDeError(error) }, { shouldFocus: true })
        setErrorEnvio(null)
        return
      }
      setErrorEnvio(aplicarErrorDeApi(error, setError, CAMPOS_ESTABLECIMIENTO))
    },
  })

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={establecimiento ? `Editar establecimiento ${establecimiento.codigo}` : 'Nuevo establecimiento'}
      alEnviar={handleSubmit((datos) => { setErrorEnvio(null); guardar.mutate(datos) })}
      enviando={guardar.isPending}
      errorEnvio={errorEnvio}
      focoAlCerrar={focoAlCerrar}
    >
      <Campo id={`${id}-codigo`} etiqueta="Código (4 dígitos)" error={errors.codigo?.message}
        ayuda={establecimiento ? 'El código no se edita.' : 'El código SUNAT del establecimiento; no se podrá cambiar.'}>
        {(a) => <Input {...a} readOnly={!!establecimiento} aria-readonly={!!establecimiento || undefined} inputMode="numeric"
          maxLength={4} autoComplete="off" className="h-9 font-mono read-only:bg-muted" {...register('codigo')} />}
      </Campo>
      <Campo id={`${id}-nombre`} etiqueta="Nombre" error={errors.nombre?.message}>
        {(a) => <Input {...a} autoComplete="off" className="h-9 uppercase" {...register('nombre')} />}
      </Campo>
      <Campo id={`${id}-texto`} etiqueta="Texto del libro 12.1" error={errors.textoLibro?.message}
        ayuda={`Si lo dejas vacío: «${textoLibroPorDefecto(codigo, nombre) || 'código-nombre'}».`}>
        {(a) => <Input {...a} autoComplete="off" className="h-9 font-mono" {...register('textoLibro')} />}
      </Campo>
      {establecimiento && (
        <Controller control={control} name="activo" render={({ field }) => (
          <CampoCasilla id={`${id}-activo`} etiqueta="Activo" ref={field.ref} marcado={field.value} alCambiar={field.onChange} />
        )} />
      )}
    </DialogoFormulario>
  )
}

export function PaginaEstablecimientos() {
  useTituloPagina('Establecimientos')
  const puedeEditar = usePuede('establecimientos:editar')
  const dialogo = useDialogo<Establecimiento>()
  const { abrir } = dialogo
  const establecimientos = useEstablecimientos()

  const columnas = useMemo<ColumnaTabla<Establecimiento>[]>(() => {
    const lista: ColumnaTabla<Establecimiento>[] = [
      { id: 'codigo', encabezado: 'Código', valor: (e) => e.codigo, celda: (e) => <span className="font-mono">{e.codigo}</span> },
      { id: 'nombre', encabezado: 'Nombre', valor: (e) => e.nombre },
      { id: 'textoLibro', encabezado: 'Texto del libro 12.1', valor: (e) => e.textoLibro, celda: (e) => <span className="font-mono">{e.textoLibro}</span> },
      { id: 'activo', encabezado: 'Estado', celda: (e) => <EstadoActivo activo={e.activo} /> },
    ]
    if (puedeEditar) {
      lista.push({
        id: 'acciones',
        encabezado: 'Acciones',
        celda: (e) => (
          <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${e.codigo}`}
            onClick={(evento) => abrir(e, evento.currentTarget)}>
            <PencilIcon aria-hidden="true" />Editar
          </Button>
        ),
      })
    }
    return lista
  }, [puedeEditar, abrir])

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Establecimientos"
        descripcion={puedeEditar ? 'El texto del libro aparece en el encabezado del libro 12.1.' : 'Solo el administrador crea y edita establecimientos.'}
        acciones={puedeEditar && (
          <Button type="button" onClick={(evento) => abrir(undefined, evento.currentTarget)}>
            <PlusIcon aria-hidden="true" />Nuevo establecimiento
          </Button>
        )}
      />
      {establecimientos.isError && <EstadoError mensaje={mensajeDeError(establecimientos.error)} alReintentar={() => void establecimientos.refetch()} />}
      <TablaDatos
        titulo="Establecimientos"
        columnas={columnas}
        datos={establecimientos.data}
        idFila={(e) => String(e.id)}
        cargando={establecimientos.isPending}
        filaAtenuada={(e) => !e.activo}
        vacio="Aún no hay establecimientos."
      />
      {puedeEditar && (
        <DialogoEstablecimiento
          key={dialogo.apertura}
          abierto={dialogo.abierto}
          alCambiarAbierto={dialogo.cambiarAbierto}
          establecimiento={dialogo.datos}
          focoAlCerrar={dialogo.disparador}
        />
      )}
    </div>
  )
}
