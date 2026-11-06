// Reglas contables (docs/UI-UX.md §5.16). No se borran: se cierran con "vigente hasta".
// Ver: todos · crear, editar y cerrar: ADMIN y CONTADOR (lib/roles.ts → 'reglas:editar').
import { useMemo } from 'react'
import { CalendarXIcon, CircleCheckIcon, CircleMinusIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { DialogoCrearRegla } from './dialogo-crear-regla'
import { DialogoEditarRegla } from './dialogo-editar-regla'
import { formatearMes, mesActual, NOMBRE_TIPO_ASIENTO, reglaCerrada } from './esquemas'
import { useReglas, type ReglaContable } from '@/api/reglas-contables'
import { useTituloPagina } from '@/app/titulo-pagina'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Button } from '@/componentes/ui/button'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { usePuede } from '@/lib/roles'

type Dialogo = { tipo: 'crear' } | { tipo: 'editar' | 'cerrar'; regla: ReglaContable }

function EstadoRegla({ regla, mes }: { regla: ReglaContable; mes: string }) {
  if (reglaCerrada(regla, mes)) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <CircleMinusIcon aria-hidden="true" className="size-3.5" />Cerrada
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-success">
      <CircleCheckIcon aria-hidden="true" className="size-3.5" />Vigente
    </span>
  )
}

export function PaginaReglas() {
  useTituloPagina('Reglas contables')
  const puedeEditar = usePuede('reglas:editar')
  const dialogo = useDialogo<Dialogo>()
  const { abrir } = dialogo
  const reglas = useReglas()
  const mes = mesActual()

  const columnas = useMemo<ColumnaTabla<ReglaContable>[]>(() => {
    const lista: ColumnaTabla<ReglaContable>[] = [
      { id: 'codigo', encabezado: 'Código', valor: (r) => r.codigo, celda: (r) => <span className="font-mono">{r.codigo}</span> },
      { id: 'tipo', encabezado: 'Tipo de asiento', valor: (r) => NOMBRE_TIPO_ASIENTO[r.tipoAsiento] },
      { id: 'producto', encabezado: 'Producto', valor: (r) => r.productoCodigo, celda: (r) => <span className="font-mono">{r.productoCodigo}</span> },
      { id: 'operacion', encabezado: 'Op.', valor: (r) => r.tipoOperacion, celda: (r) => <span className="font-mono">{r.tipoOperacion}</span> },
      { id: 'debe', encabezado: 'Cuenta Debe', valor: (r) => r.cuentaDebe, celda: (r) => <span className="font-mono">{r.cuentaDebe}</span> },
      { id: 'haber', encabezado: 'Cuenta Haber', valor: (r) => r.cuentaHaber, celda: (r) => <span className="font-mono">{r.cuentaHaber}</span> },
      { id: 'desde', encabezado: 'Vigente desde', valor: (r) => r.vigenteDesde, celda: (r) => formatearMes(r.vigenteDesde) },
      { id: 'hasta', encabezado: 'Vigente hasta', valor: (r) => r.vigenteHasta ?? '9999-99', celda: (r) => formatearMes(r.vigenteHasta) },
      { id: 'estado', encabezado: 'Estado', celda: (r) => <EstadoRegla regla={r} mes={mes} /> },
      { id: 'descripcion', encabezado: 'Descripción', valor: (r) => r.descripcion, className: 'max-w-64 truncate' },
      { id: 'decision', encabezado: 'Decisión', valor: (r) => r.decision },
    ]
    if (puedeEditar) {
      lista.push({
        id: 'acciones',
        encabezado: 'Acciones',
        celda: (r) => (
          <span className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" aria-label={`Editar ${r.codigo}`}
              onClick={(e) => abrir({ tipo: 'editar', regla: r }, e.currentTarget)}>
              <PencilIcon aria-hidden="true" />Editar
            </Button>
            {!reglaCerrada(r, mes) && (
              <Button type="button" variant="ghost" size="sm" aria-label={`Cerrar regla ${r.codigo}`}
                onClick={(e) => abrir({ tipo: 'cerrar', regla: r }, e.currentTarget)}>
                <CalendarXIcon aria-hidden="true" />Cerrar regla
              </Button>
            )}
          </span>
        ),
      })
    }
    return lista
  }, [puedeEditar, mes, abrir])

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Reglas contables"
        descripcion="Cuentas Debe y Haber por tipo de asiento, producto y operación. Las reglas no se borran: se cierran con «vigente hasta»."
        acciones={puedeEditar && (
          <Button type="button" onClick={(e) => abrir({ tipo: 'crear' }, e.currentTarget)}>
            <PlusIcon aria-hidden="true" />
            Nueva regla
          </Button>
        )}
      />
      {reglas.isError && <EstadoError mensaje={mensajeDeError(reglas.error)} alReintentar={() => void reglas.refetch()} />}
      <TablaDatos
        titulo="Reglas contables"
        columnas={columnas}
        datos={reglas.data}
        idFila={(r) => String(r.id)}
        cargando={reglas.isPending}
        ayudaBusqueda="Código, producto, cuenta o descripción"
        filaAtenuada={(r) => reglaCerrada(r, mes)}
        vacio="Aún no hay reglas contables. Sin ellas no se pueden exportar los asientos."
      />
      {puedeEditar && dialogo.datos?.tipo === 'crear' && (
        <DialogoCrearRegla key={dialogo.apertura} abierto={dialogo.abierto} alCambiarAbierto={dialogo.cambiarAbierto}
          reglas={reglas.data ?? []} focoAlCerrar={dialogo.disparador} />
      )}
      {puedeEditar && dialogo.datos && dialogo.datos.tipo !== 'crear' && (
        <DialogoEditarRegla
          key={dialogo.apertura}
          abierto={dialogo.abierto}
          alCambiarAbierto={dialogo.cambiarAbierto}
          regla={dialogo.datos.regla}
          soloCerrar={dialogo.datos.tipo === 'cerrar'}
          reglas={reglas.data ?? []}
          focoAlCerrar={dialogo.disparador}
        />
      )}
    </div>
  )
}
