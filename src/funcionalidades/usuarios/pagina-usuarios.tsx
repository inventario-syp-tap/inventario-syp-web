// Usuarios (docs/UI-UX.md §5.18, solo ADMIN): crear, cambiar nombre y roles, activar o desactivar (cierra sus
// sesiones) y restablecer la contraseña. La temporal se muestra una sola vez; si ya venció (passwordTemporalExpira)
// la tabla lo indica y hay que restablecerla. Un ADMIN no se desactiva ni se quita su rol (la API lo impide igual).
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRoundIcon, LockIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon, TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { DialogoPasswordTemporal } from './dialogo-password-temporal'
import { DialogoUsuario } from './dialogo-usuario'
import { NOMBRE_ROL } from './esquemas'
import { CLAVES } from '@/api/claves'
import { editarUsuario, restablecerPassword, temporalVencida, useUsuarios, type Usuario } from '@/api/usuarios'
import { useTituloPagina } from '@/app/titulo-pagina'
import { DialogoConfirmacion } from '@/componentes/comunes/dialogo-confirmacion'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoActivo } from '@/componentes/comunes/estado-activo'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearFechaHora } from '@/lib/formato'
import { useSesion } from '@/lib/sesion'

const TAMANO = 50

type Confirmacion = { tipo: 'activar' | 'desactivar' | 'restablecer'; usuario: Usuario } | null

/** Estado de la contraseña temporal: pendiente de cambio, vigente hasta… o vencida. */
function EstadoTemporal({ usuario }: { usuario: Usuario }) {
  if (!usuario.debeCambiarPassword) return <span className="text-muted-foreground">—</span>
  if (temporalVencida(usuario)) {
    return (
      <span className="inline-flex items-center gap-1 text-warning">
        <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
        Temporal vencida: restablécela
      </span>
    )
  }
  return (
    <span className="text-xs">
      Pendiente de cambio{usuario.passwordTemporalExpira ? ` · vence ${formatearFechaHora(usuario.passwordTemporalExpira)}` : ''}
    </span>
  )
}

export function PaginaUsuarios() {
  useTituloPagina('Usuarios')
  const { usuario: sesion } = useSesion()
  const clienteConsultas = useQueryClient()
  const [pagina, setPagina] = useState(1)
  const dialogo = useDialogo<Usuario>()
  const { abrir, disparador } = dialogo
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null)
  const [temporal, setTemporal] = useState<{ email: string; password: string } | null>(null)
  const usuarios = useUsuarios(pagina, TAMANO)


  const cambiarActivo = useMutation({
    mutationFn: ({ usuario, activo }: { usuario: Usuario; activo: boolean }) => editarUsuario(usuario.id, { activo }),
    onSuccess: (guardado) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.usuarios })
      toast.success(guardado.activo ? `${guardado.email} activado` : `${guardado.email} desactivado: sus sesiones se cerraron`)
    },
    onError: (error) => toast.error(mensajeDeError(error), { duration: Infinity }),
  })

  const restablecer = useMutation({ mutationFn: (usuario: Usuario) => restablecerPassword(usuario.id), gcTime: 0 })

  const columnas = useMemo<ColumnaTabla<Usuario>[]>(() => [
    { id: 'nombre', encabezado: 'Nombre', valor: (u) => u.nombre },
    { id: 'email', encabezado: 'Correo', valor: (u) => u.email },
    {
      id: 'roles',
      encabezado: 'Roles',
      celda: (u) => <span className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r} variant="secondary">{NOMBRE_ROL[r].nombre}</Badge>)}</span>,
    },
    {
      id: 'estado',
      encabezado: 'Estado',
      celda: (u) => (
        <span className="flex flex-col gap-0.5">
          <EstadoActivo activo={u.activo} />
          {u.bloqueado && (
            <span className="inline-flex items-center gap-1 text-xs text-destructive">
              <LockIcon aria-hidden="true" className="size-3.5" />Bloqueado por intentos
            </span>
          )}
        </span>
      ),
    },
    { id: 'temporal', encabezado: 'Contraseña', celda: (u) => <EstadoTemporal usuario={u} /> },
    { id: 'ultimoAcceso', encabezado: 'Último acceso', celda: (u) => <span className="tabular-nums">{formatearFechaHora(u.ultimoAcceso)}</span> },
    {
      id: 'acciones',
      encabezado: 'Acciones',
      celda: (u) => {
        const unoMismo = u.id === sesion?.id
        return (
          <span className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" aria-label={`Editar a ${u.nombre}`}
              onClick={(e) => abrir(u, e.currentTarget)}>
              <PencilIcon aria-hidden="true" />Editar
            </Button>
            <Button type="button" variant="ghost" size="sm" aria-label={`Restablecer contraseña de ${u.nombre}`}
              onClick={(e) => { disparador.current = e.currentTarget; setConfirmacion({ tipo: 'restablecer', usuario: u }) }}>
              <KeyRoundIcon aria-hidden="true" />Restablecer contraseña
            </Button>
            {!unoMismo && (
              <Button type="button" variant="ghost" size="sm" aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
                onClick={(e) => { disparador.current = e.currentTarget; setConfirmacion({ tipo: u.activo ? 'desactivar' : 'activar', usuario: u }) }}>
                {u.activo ? <PowerOffIcon aria-hidden="true" /> : <PowerIcon aria-hidden="true" />}
                {u.activo ? 'Desactivar' : 'Activar'}
              </Button>
            )}
          </span>
        )
      },
    },
  ], [sesion?.id, abrir, disparador])

  const confirmar = () => {
    if (!confirmacion) return
    const { tipo, usuario } = confirmacion
    if (tipo === 'restablecer') {
      restablecer.mutate(usuario, {
        onSuccess: (respuesta) => {
          void clienteConsultas.invalidateQueries({ queryKey: CLAVES.usuarios })
          setTemporal({ email: usuario.email, password: respuesta.passwordTemporal })
          restablecer.reset()
        },
        onError: (error) => toast.error(mensajeDeError(error), { duration: Infinity }),
      })
    } else {
      cambiarActivo.mutate({ usuario, activo: tipo === 'activar' })
    }
  }

  const textos = confirmacion && {
    restablecer: {
      titulo: `¿Restablecer la contraseña de ${confirmacion.usuario.nombre}?`,
      descripcion: 'Se generará una contraseña temporal nueva (se muestra una sola vez), la actual dejará de servir y se cerrarán sus sesiones.',
      boton: 'Restablecer',
    },
    desactivar: {
      titulo: `¿Desactivar a ${confirmacion.usuario.nombre}?`,
      descripcion: 'No podrá ingresar y se cerrarán todas sus sesiones. Puedes volver a activarlo cuando quieras.',
      boton: 'Desactivar',
    },
    activar: {
      titulo: `¿Activar a ${confirmacion.usuario.nombre}?`,
      descripcion: 'Podrá volver a ingresar con su contraseña.',
      boton: 'Activar',
    },
  }[confirmacion.tipo]

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas del módulo de inventario y sus roles."
        acciones={(
          <Button type="button" onClick={(e) => abrir(undefined, e.currentTarget)}>
            <PlusIcon aria-hidden="true" />Nuevo usuario
          </Button>
        )}
      />
      {usuarios.isError && <EstadoError mensaje={mensajeDeError(usuarios.error)} alReintentar={() => void usuarios.refetch()} />}
      <TablaDatos
        titulo="Usuarios"
        columnas={columnas}
        datos={usuarios.data?.datos}
        idFila={(u) => u.id}
        cargando={usuarios.isPending}
        paginacionServidor={{ pagina, tamano: TAMANO, total: usuarios.data?.total ?? 0, alCambiarPagina: setPagina }}
        filaAtenuada={(u) => !u.activo}
        vacio="Aún no hay usuarios."
      />
      <DialogoUsuario
        key={dialogo.apertura}
        abierto={dialogo.abierto}
        alCambiarAbierto={dialogo.cambiarAbierto}
        usuario={dialogo.datos}
        esUnoMismo={dialogo.datos?.id === sesion?.id}
        alCrear={(email, password) => setTemporal({ email, password })}
        focoAlCerrar={disparador}
      />
      {textos && (
        <DialogoConfirmacion
          abierto={confirmacion !== null}
          alCambiarAbierto={(abierto) => { if (!abierto) setConfirmacion(null) }}
          titulo={textos.titulo}
          descripcion={textos.descripcion}
          textoConfirmar={textos.boton}
          destructiva={confirmacion?.tipo === 'desactivar'}
          alConfirmar={confirmar}
          focoAlCerrar={disparador}
        />
      )}
      <DialogoPasswordTemporal datos={temporal} alCerrar={() => setTemporal(null)} focoAlCerrar={disparador} />
    </div>
  )
}
