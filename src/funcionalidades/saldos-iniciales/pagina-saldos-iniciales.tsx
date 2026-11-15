// Saldos iniciales (docs/UI-UX.md §5.10): tabla por año y producto con cantidad, C.U. (costoUnitario de la API),
// total, origen (Importación, Cierre anual, Manual) y la marca ⚠ "Desactualizado". Todos ven; A y C editan un saldo
// como manual y crean uno nuevo para un producto sin saldo en el año (motivo obligatorio en ambos casos).
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PencilIcon, PlusIcon } from 'lucide-react'
import { DialogoNuevoSaldo } from './dialogo-nuevo-saldo'
import { DialogoSaldoInicial } from './dialogo-saldo-inicial'
import { textoProducto, useProductos } from '@/api/productos'
import { NOMBRE_ORIGEN, useSaldosIniciales, type SaldoInicial } from '@/api/saldos-iniciales'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { Cifra } from '@/componentes/comunes/cifra'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { IconoAlerta } from '@/componentes/comunes/icono-alerta'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { TablaDatos, type ColumnaTabla } from '@/componentes/comunes/tabla-datos'
import { Button } from '@/componentes/ui/button'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearFechaHora } from '@/lib/formato'
import { anioDeUrl } from '@/lib/periodos'
import { usePuede } from '@/lib/roles'

export function PaginaSaldosIniciales() {
  useTituloPagina('Saldos iniciales')
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros)
  const saldos = useSaldosIniciales(anio)
  const productos = useProductos()
  const puedeEditar = usePuede('saldos:editar')
  // El asistente de cierre anual es solo de A y C: a los demás no se les ofrece el enlace.
  const puedeCierreAnual = usePuede('periodos:cierre-anual')
  const editar = useDialogo<SaldoInicial>()
  const { abrir } = editar
  const nuevo = useDialogo()
  // Solo los productos activos sin saldo inicial en el año (los que ya tienen, se editan desde la tabla).
  const sinSaldo = useMemo(() => {
    const conSaldo = new Set((saldos.data ?? []).map((s) => s.productoId))
    return (productos.data ?? []).filter((p) => p.activo && !conSaldo.has(p.id))
  }, [productos.data, saldos.data])

  const nombre = useMemo(() => {
    const lista = productos.data ?? []
    return (s: Pick<SaldoInicial, 'productoId' | 'productoCodigo'>) => {
      const producto = lista.find((p) => p.id === s.productoId)
      return producto ? textoProducto(producto) : s.productoCodigo
    }
  }, [productos.data])

  const columnas = useMemo<ColumnaTabla<SaldoInicial>[]>(() => [
    { id: 'producto', encabezado: 'Producto', valor: (s) => nombre(s) },
    { id: 'cantidad', encabezado: 'Cantidad TN', numerica: true, celda: (s) => <Cifra tipo="toneladas" valor={s.cantidad} /> },
    { id: 'cu', encabezado: 'C.U.', numerica: true, celda: (s) => <Cifra tipo="cu" valor={s.costoUnitario} /> },
    { id: 'total', encabezado: 'Total S/', numerica: true, celda: (s) => <Cifra tipo="importe" valor={s.costoTotal} /> },
    { id: 'origen', encabezado: 'Origen', valor: (s) => NOMBRE_ORIGEN[s.origen] },
    {
      id: 'estado',
      encabezado: 'Estado',
      celda: (s) => (s.desactualizado ? (
        <span className="inline-flex flex-col gap-0.5">
          <IconoAlerta codigo="SI_DESACTUALIZADO" />
          {puedeCierreAnual && (
            <Link className="text-xs underline underline-offset-2" to={`${RAIZ_MODULO}/periodos/cierre-anual?anio=${s.anio - 1}`}>
              Revisar en el cierre anual {s.anio - 1}
            </Link>
          )}
        </span>
      ) : <span className="text-muted-foreground">Al día</span>),
    },
    {
      id: 'motivo',
      encabezado: 'Motivo y registro',
      celda: (s) => (
        <span className="flex flex-col text-xs">
          {s.motivo && <span className="text-foreground">{s.motivo}</span>}
          <span className="text-muted-foreground">
            {s.registradoPor ? `${s.registradoPor} · ` : ''}{formatearFechaHora(s.actualizadoEn)}
          </span>
        </span>
      ),
    },
    ...(puedeEditar ? [{
      id: 'acciones',
      encabezado: 'Acciones',
      celda: (s: SaldoInicial) => (
        <Button type="button" variant="ghost" size="sm" aria-label={`Editar el saldo inicial ${s.anio} de ${s.productoCodigo}`}
          onClick={(e) => abrir(s, e.currentTarget)}>
          <PencilIcon aria-hidden="true" />
          Editar
        </Button>
      ),
    }] : []),
  ], [nombre, puedeEditar, puedeCierreAnual, abrir])

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Saldos iniciales"
        descripcion="Saldo al 1 de enero de cada año por producto. Normalmente lo genera el cierre anual del año anterior."
        acciones={puedeEditar && (
          <div className="flex flex-col items-end gap-1">
            <Button type="button" disabled={!saldos.data || !productos.data || sinSaldo.length === 0}
              aria-describedby={saldos.data && productos.data && sinSaldo.length === 0 ? 'ayuda-nuevo-saldo' : undefined}
              onClick={(e) => nuevo.abrir(undefined, e.currentTarget)}>
              <PlusIcon aria-hidden="true" />
              Nuevo saldo manual
            </Button>
            {saldos.data && productos.data && sinSaldo.length === 0 && (
              <p id="ayuda-nuevo-saldo" className="text-xs text-muted-foreground">Todos los productos ya tienen saldo en {anio}.</p>
            )}
          </div>
        )}
      />
      <SelectorPeriodo anio={anio} alCambiarAnio={(nuevo) => setParametros({ anio: String(nuevo) }, { replace: true })} />
      {saldos.isError ? (
        <EstadoError mensaje={mensajeDeError(saldos.error)} alReintentar={() => void saldos.refetch()} />
      ) : (
        <TablaDatos
          titulo={`Saldos iniciales de ${anio}`}
          columnas={columnas}
          datos={saldos.data}
          idFila={(s) => String(s.id)}
          cargando={saldos.isPending}
          vacio={(
            <span>
              No hay saldos iniciales de {anio}. Se generan con el cierre anual de {anio - 1}.{' '}
              {puedeCierreAnual && (
                <Link className="underline underline-offset-2" to={`${RAIZ_MODULO}/periodos/cierre-anual?anio=${anio - 1}`}>
                  Ir al cierre anual {anio - 1}
                </Link>
              )}
            </span>
          )}
        />
      )}
      {nuevo.apertura > 0 && (
        <DialogoNuevoSaldo key={`${nuevo.apertura}-${anio}`} anio={anio} productos={sinSaldo}
          abierto={nuevo.abierto} alCambiarAbierto={nuevo.cambiarAbierto} focoAlCerrar={nuevo.disparador} />
      )}
      {editar.datos && (
        <DialogoSaldoInicial key={editar.apertura} saldo={editar.datos} producto={nombre(editar.datos)}
          abierto={editar.abierto} alCambiarAbierto={editar.cambiarAbierto} focoAlCerrar={editar.disparador} />
      )}
    </div>
  )
}
