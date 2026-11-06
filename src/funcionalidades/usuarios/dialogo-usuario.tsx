// Nuevo usuario o edición de nombre y roles (docs/UI-UX.md §5.18, solo ADMIN). Al crear, la API devuelve la
// contraseña temporal una sola vez: se entrega a la pantalla para mostrarla y la mutación se limpia enseguida
// (gcTime 0 + reset), para que no quede en la caché de TanStack Query.
import { useId, useState, type RefObject } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  esquemaEditarUsuario, esquemaNuevoUsuario, NOMBRE_ROL, ROLES_USUARIO, type FormularioNuevoUsuario,
} from './esquemas'
import { CLAVES } from '@/api/claves'
import { crearUsuario, editarUsuario, type DatosEditarUsuario, type RolUsuario, type Usuario } from '@/api/usuarios'
import { Campo } from '@/componentes/comunes/campo'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Checkbox } from '@/componentes/ui/checkbox'
import { FieldDescription, FieldError, FieldLegend, FieldSet } from '@/componentes/ui/field'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  usuario?: Usuario
  /** El ADMIN que edita su propia cuenta no puede quitarse el rol ADMIN. */
  esUnoMismo?: boolean
  alCrear: (email: string, passwordTemporal: string) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

const valores = (usuario?: Usuario): FormularioNuevoUsuario => ({
  email: usuario?.email ?? '',
  nombre: usuario?.nombre ?? '',
  roles: usuario ? [...usuario.roles] : [],
})

/** Cambios del PATCH (solo lo que cambió). */
function cambiosUsuario(datos: FormularioNuevoUsuario, original: Usuario): DatosEditarUsuario {
  const cambios: DatosEditarUsuario = {}
  if (datos.nombre !== original.nombre) cambios.nombre = datos.nombre
  const ordenar = (lista: readonly RolUsuario[]) => [...lista].sort().join(',')
  if (ordenar(datos.roles) !== ordenar(original.roles)) cambios.roles = datos.roles
  return cambios
}

export function DialogoUsuario({ abierto, alCambiarAbierto, usuario, esUnoMismo = false, alCrear, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  // La página le cambia la `key` en cada apertura: el formulario nace limpio.
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm<FormularioNuevoUsuario>({
    // Al editar el correo no cambia: se valida solo nombre y roles (el correo pasa tal cual).
    resolver: zodResolver(usuario ? esquemaEditarUsuario.extend({ email: z.string() }) : esquemaNuevoUsuario),
    defaultValues: valores(usuario),
  })

  const crear = useMutation({ mutationFn: crearUsuario, gcTime: 0 })
  const editar = useMutation({
    mutationFn: (datos: DatosEditarUsuario) => editarUsuario(usuario?.id ?? '', datos),
    onSuccess: (guardado) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.usuarios })
      toast.success(`Usuario ${guardado.email} actualizado`)
      alCambiarAbierto(false)
    },
  })

  const alError = (error: unknown) => setErrorEnvio(aplicarErrorDeApi(error, setError, ['email', 'nombre', 'roles']))

  const enviar = handleSubmit((datos) => {
    setErrorEnvio(null)
    if (usuario) {
      const cambios = cambiosUsuario(datos, usuario)
      if (Object.keys(cambios).length === 0) {
        alCambiarAbierto(false)
        return
      }
      editar.mutate(cambios, { onError: alError })
      return
    }
    crear.mutate(datos, {
      onSuccess: (creado) => {
        void clienteConsultas.invalidateQueries({ queryKey: CLAVES.usuarios })
        alCambiarAbierto(false)
        alCrear(creado.usuario.email, creado.passwordTemporal)
        crear.reset()
      },
      onError: alError,
    })
  })

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={usuario ? `Editar a ${usuario.nombre}` : 'Nuevo usuario'}
      descripcion={usuario
        ? 'Cambiar los roles cierra sus sesiones abiertas.'
        : 'Se generará una contraseña temporal que se muestra una sola vez; deberá cambiarla al ingresar.'}
      textoGuardar={usuario ? 'Guardar' : 'Crear usuario'}
      alEnviar={enviar}
      enviando={crear.isPending || editar.isPending}
      errorEnvio={errorEnvio}
      focoAlCerrar={focoAlCerrar}
    >
      <Campo id={`${id}-email`} etiqueta="Correo" error={errors.email?.message} ayuda={usuario ? 'El correo no se cambia.' : undefined}>
        {(a) => <Input {...a} type="email" autoComplete="off" readOnly={!!usuario} aria-readonly={!!usuario || undefined}
          className="h-9 read-only:bg-muted" {...register('email')} />}
      </Campo>
      <Campo id={`${id}-nombre`} etiqueta="Nombre" error={errors.nombre?.message}>
        {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('nombre')} />}
      </Campo>
      <Controller
        control={control}
        name="roles"
        render={({ field }) => (
          <FieldSet aria-describedby={errors.roles ? `${id}-roles-error` : undefined}>
            <FieldLegend variant="label">Roles</FieldLegend>
            {ROLES_USUARIO.map((rol, indice) => {
              const bloqueado = esUnoMismo && rol === 'ADMIN'
              return (
                <div key={rol} className="flex items-start gap-2">
                  <Checkbox
                    id={`${id}-rol-${rol}`}
                    ref={indice === 0 ? field.ref : undefined}
                    checked={field.value.includes(rol)}
                    disabled={bloqueado}
                    aria-describedby={`${id}-rol-${rol}-ayuda`}
                    onCheckedChange={(marcado) => field.onChange(
                      marcado === true ? [...field.value, rol] : field.value.filter((r) => r !== rol),
                    )}
                  />
                  <div className="flex flex-col">
                    <Label htmlFor={`${id}-rol-${rol}`}>{NOMBRE_ROL[rol].nombre}</Label>
                    <FieldDescription id={`${id}-rol-${rol}-ayuda`} className="text-xs">
                      {bloqueado ? 'No puedes quitarte el rol de administrador.' : NOMBRE_ROL[rol].ayuda}
                    </FieldDescription>
                  </div>
                </div>
              )
            })}
            <FieldError id={`${id}-roles-error`} errors={errors.roles ? [errors.roles] : []} />
          </FieldSet>
        )}
      />
    </DialogoFormulario>
  )
}
