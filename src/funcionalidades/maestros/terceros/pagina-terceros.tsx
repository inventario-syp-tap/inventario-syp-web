// Clientes y proveedores (docs/UI-UX.md §5.16). La API pagina: búsqueda ?q= (documento o razón social) y ?rol=.
// Ver: todos · crear y editar: ADMIN, CONTADOR y ASISTENTE (lib/roles.ts → 'terceros:editar').
import { useEffect, useId, useMemo, useState } from 'react'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { DialogoTercero } from './dialogo-tercero'
import { textoDocumento } from './esquemas'
import { useTerceros, type RolTercero, type Tercero } from '@/api/terceros'
import { useTituloPagina } from '@/app/titulo-pagina'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { EstadoActivo } from '@/componentes/comunes/estado-activo'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Badge } from '@/componentes/ui/badge'
import { Button } from '@/componentes/ui/button'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { usePuede } from '@/lib/roles'

const TAMANO = 50
const ESPERA_BUSQUEDA_MS = 300

export function PaginaTerceros() {
  useTituloPagina('Clientes y proveedores')
  const idRol = useId()
  const puedeEditar = usePuede('terceros:editar')
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [rol, setRol] = useState<RolTercero | ''>('')
  const [pagina, setPagina] = useState(1)
  const dialogo = useDialogo<Tercero>()
  const { abrir } = dialogo

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setQ(texto.trim())
      setPagina(1)
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [texto])

  const consulta = useTerceros({ q: q || undefined, rol: rol || undefined, pagina, tamano: TAMANO })

  const columnas = useMemo<ColumnaTabla<Tercero>[]>(() => {
    const lista: ColumnaTabla<Tercero>[] = [
      { id: 'documento', encabezado: 'Documento', valor: (t) => t.numeroDocumento, celda: (t) => <span className="font-mono">{textoDocumento(t)}</span> },
      { id: 'razonSocial', encabezado: 'Razón social', valor: (t) => t.razonSocial },
      {
        id: 'rol',
        encabezado: 'Rol',
        celda: (t) => (
          <span className="flex gap-1">
            {t.esProveedor && <Badge variant="secondary">Proveedor</Badge>}
            {t.esCliente && <Badge variant="outline">Cliente</Badge>}
          </span>
        ),
      },
      { id: 'pais', encabezado: 'País', valor: (t) => t.pais ?? '—' },
      { id: 'activo', encabezado: 'Estado', celda: (t) => <EstadoActivo activo={t.activo} /> },
    ]
    if (puedeEditar) {
      lista.push({
        id: 'acciones',
        encabezado: 'Acciones',
        celda: (t) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Editar ${t.razonSocial}`}
            onClick={(evento) => abrir(t, evento.currentTarget)}
          >
            <PencilIcon aria-hidden="true" />
            Editar
          </Button>
        ),
      })
    }
    return lista
  }, [puedeEditar, abrir])

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Clientes y proveedores"
        descripcion="Busca por RUC, DNI o razón social. El RUC se valida con su dígito verificador."
        acciones={puedeEditar && (
          <Button
            type="button"
            onClick={(evento) => abrir(undefined, evento.currentTarget)}
          >
            <PlusIcon aria-hidden="true" />
            Nuevo cliente o proveedor
          </Button>
        )}
      />
      {consulta.isError && <EstadoError mensaje={mensajeDeError(consulta.error)} alReintentar={() => void consulta.refetch()} />}
      <TablaDatos
        titulo="Clientes y proveedores"
        columnas={columnas}
        datos={consulta.data?.datos}
        idFila={(t) => String(t.id)}
        cargando={consulta.isPending}
        ayudaBusqueda="RUC, DNI o razón social"
        busqueda={{ valor: texto, alCambiar: setTexto }}
        paginacionServidor={{ pagina, tamano: TAMANO, total: consulta.data?.total ?? 0, alCambiarPagina: setPagina }}
        filaAtenuada={(t) => !t.activo}
        vacio={q || rol ? 'No hay clientes ni proveedores con esos filtros.' : 'Aún no hay clientes ni proveedores.'}
        filtros={(
          <div className="flex flex-col gap-1">
            <label htmlFor={idRol} className="text-sm font-medium">Rol</label>
            <CampoSelect
              id={idRol}
              className="w-44"
              value={rol}
              onChange={(evento) => {
                setRol(evento.target.value as RolTercero | '')
                setPagina(1)
              }}
              vacio="Todos"
              opciones={[{ valor: 'PROVEEDOR', texto: 'Proveedores' }, { valor: 'CLIENTE', texto: 'Clientes' }]}
            />
          </div>
        )}
      />
      {puedeEditar && (
        <DialogoTercero
          key={dialogo.apertura}
          abierto={dialogo.abierto}
          alCambiarAbierto={dialogo.cambiarAbierto}
          tercero={dialogo.datos}
          focoAlCerrar={dialogo.disparador}
        />
      )}
    </div>
  )
}
