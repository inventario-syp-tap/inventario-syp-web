// Detalle del comprobante (/inventario/comprobantes/:id): la misma vista del panel lateral, para enlaces directos,
// con Editar (?editar=1, mismo formulario del registro; PATCH con solo lo que cambió) y Anular (motivo obligatorio).
// Un anulado queda en solo lectura.
import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeftIcon, PencilIcon, XIcon } from 'lucide-react'
import { DetalleComprobante } from './detalle-comprobante'
import { DialogoAnular } from './dialogo-anular'
import { documentoComprobante, nombreOperacion } from './esquemas'
import { FormularioComprobante } from './formulario/formulario-comprobante'
import { EsqueletoFormulario } from './paginas-registro'
import { useComprobante } from '@/api/comprobantes'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Button } from '@/componentes/ui/button'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { puede, puedeEditarComprobante } from '@/lib/roles'
import { useSesion } from '@/lib/sesion'

export function PaginaDetalleComprobante() {
  const { id } = useParams()
  const [parametros, setParametros] = useSearchParams()
  const { usuario } = useSesion()
  const roles = usuario?.roles ?? []
  const consulta = useComprobante(id)
  const anular = useDialogo()
  const botonEditar = useRef<HTMLButtonElement>(null)
  const tituloPagina = useRef<HTMLHeadingElement>(null)
  // Tras guardar o cancelar la edición el formulario se desmonta: el foco vuelve a «Editar» (docs/UI-UX.md §6).
  // Se marca aquí y se aplica cuando la página ya salió del modo edición (la URL cambia de forma asíncrona).
  const volverDeEditar = useRef(false)
  const enfocarTrasEditar = () => {
    volverDeEditar.current = true
  }
  const comprobante = consulta.data
  const titulo = comprobante ? `${nombreOperacion(comprobante)} ${documentoComprobante(comprobante)}` : 'Detalle del comprobante'
  useTituloPagina(titulo)

  const puedeEditar = !!comprobante && puedeEditarComprobante(comprobante, roles)
  const puedeAnular = !!comprobante && comprobante.estado === 'REGISTRADO' && puede('comprobantes:anular', roles)
  const editando = puedeEditar && parametros.get('editar') === '1'

  useEffect(() => {
    if (editando || !volverDeEditar.current) return
    volverDeEditar.current = false
    ;(botonEditar.current ?? tituloPagina.current)?.focus()
  }, [editando])

  const volver = (
    <Button asChild variant="ghost" size="sm">
      <Link to={`${RAIZ_MODULO}/comprobantes`}>
        <ArrowLeftIcon aria-hidden="true" />
        Comprobantes
      </Link>
    </Button>
  )

  if (consulta.isError) {
    return (
      <div className="flex flex-col gap-4">
        <div>{volver}</div>
        <EstadoError mensaje={mensajeDeError(consulta.error)} alReintentar={() => void consulta.refetch()} />
      </div>
    )
  }
  if (!comprobante) {
    return (
      <div className="flex flex-col gap-4">
        <div>{volver}</div>
        <EsqueletoFormulario />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>{volver}</div>
      <EncabezadoPagina
        refTitulo={tituloPagina}
        titulo={editando ? `Editar ${titulo.charAt(0).toLowerCase()}${titulo.slice(1)}` : titulo}
        descripcion={editando ? 'Al guardar, la API recalcula el kardex del año.' : undefined}
        acciones={!editando && (
          <>
            {puedeEditar && (
              <Button ref={botonEditar} type="button" variant="outline" onClick={() => setParametros({ editar: '1' })}>
                <PencilIcon aria-hidden="true" />
                Editar
              </Button>
            )}
            {puedeAnular && (
              <Button type="button" variant="destructive" onClick={(e) => anular.abrir(undefined, e.currentTarget)}>
                <XIcon aria-hidden="true" />
                Anular
              </Button>
            )}
          </>
        )}
      />
      {editando ? (
        <FormularioComprobante
          key={comprobante.id}
          naturaleza={comprobante.naturaleza}
          fechaInicial={comprobante.fecha}
          establecimientoInicial={String(comprobante.lineas[0]?.establecimientoId ?? '')}
          comprobante={comprobante}
          alTerminarEdicion={() => {
            setParametros({})
            enfocarTrasEditar()
          }}
        />
      ) : (
        <DetalleComprobante comprobante={comprobante} />
      )}
      {puedeAnular && (
        <DialogoAnular
          comprobante={comprobante}
          abierto={anular.abierto}
          alCambiarAbierto={anular.cambiarAbierto}
          focoAlCerrar={anular.disparador}
          // Ya anulado no hay «Editar» ni «Anular»: el foco pasa al título.
          alAnular={() => setTimeout(() => tituloPagina.current?.focus(), 0)}
        />
      )}
    </div>
  )
}
