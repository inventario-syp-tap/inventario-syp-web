// Asientos y WinConta (docs/UI-UX.md §5.13). Todos ven; A y C exportan. Año, mes y pestaña en la URL
// (?anio&mes&grupo). Una pestaña por grupo (Costo de ventas, Mermas, Desmedros y Ajustes, que reúne faltante y
// sobrante) y, dentro, una sección por tipo de asiento con su tabla Debe/Haber, los movimientos sin regla y el motivo
// si no se puede exportar. Debajo, el historial de exportaciones del año.
import { useSearchParams } from 'react-router'
import { TriangleAlertIcon } from 'lucide-react'
import { DialogoExportarWinConta } from './dialogo-exportar-winconta'
import { HistorialExportaciones } from './historial-exportaciones'
import { SeccionAsiento } from './seccion-asiento'
import { GRUPOS_ASIENTO, useAsientos, type Asiento } from '@/api/asientos'
import { useTituloPagina } from '@/app/titulo-pagina'
import { ChipEstadoPeriodo } from '@/componentes/comunes/chip-estado-periodo'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs'
import { useDialogo } from '@/hooks/use-dialogo'
import { mensajeDeError } from '@/lib/errores'
import { formatearPeriodo, hoyIso } from '@/lib/formato'
import { anioDeUrl } from '@/lib/periodos'
import { usePuede } from '@/lib/roles'

/** Mes de la URL (1–12) o, si no viene o no es válido, el mes en curso (Lima). */
function mesDeUrl(parametros: URLSearchParams): number {
  const mes = Number.parseInt(parametros.get('mes') ?? '', 10)
  return Number.isInteger(mes) && mes >= 1 && mes <= 12 ? mes : Number.parseInt(hoyIso().slice(5, 7), 10)
}

export function PaginaAsientos() {
  useTituloPagina('Asientos')
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros)
  const mes = mesDeUrl(parametros)
  const grupo = GRUPOS_ASIENTO.find((g) => g.id === parametros.get('grupo'))?.id ?? GRUPOS_ASIENTO[0].id
  const asientos = useAsientos(anio, mes)
  const puedeExportar = usePuede('asientos:exportar')
  const dialogo = useDialogo<Asiento>()
  const periodo = formatearPeriodo(anio, mes)

  const cambiar = (cambios: { anio?: number; mes?: number; grupo?: string }) => {
    const siguiente = { anio, mes, grupo, ...cambios }
    setParametros({ anio: String(siguiente.anio), mes: String(siguiente.mes), grupo: siguiente.grupo }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Asientos"
        descripcion="Asientos contables sugeridos del mes por tipo, con sus cuentas e importes a 2 decimales. Se exportan a WinConta cuando el mes está cerrado."
      />
      <div className="flex flex-wrap items-end gap-4">
        <SelectorPeriodo anio={anio} mes={mes} alCambiarAnio={(a) => cambiar({ anio: a })} alCambiarMes={(m) => cambiar({ mes: m ?? mes })} />
        {asientos.data && (
          <p className="inline-flex items-center gap-2 pb-1.5 text-sm">Mes: <ChipEstadoPeriodo estado={asientos.data.estadoMes} /></p>
        )}
      </div>

      {asientos.isError ? (
        <EstadoError mensaje={mensajeDeError(asientos.error)} alReintentar={() => void asientos.refetch()} />
      ) : !asientos.data ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Cargando los asientos…</span>
          <Skeleton className="h-9 w-96 max-w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Tabs value={grupo} onValueChange={(valor) => cambiar({ grupo: valor })}>
          <TabsList className="h-auto flex-wrap">
            {GRUPOS_ASIENTO.map((g) => {
              const faltaRegla = asientos.data.asientos.some((a) => g.tipos.includes(a.tipoAsiento) && a.faltantes.length > 0)
              return (
                <TabsTrigger key={g.id} value={g.id}>
                  {g.titulo}
                  {faltaRegla && (
                    <>
                      <TriangleAlertIcon aria-hidden="true" className="size-3.5 text-warning" />
                      <span className="sr-only"> (falta regla contable)</span>
                    </>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
          {GRUPOS_ASIENTO.map((g) => {
            const delGrupo = asientos.data.asientos.filter((a) => g.tipos.includes(a.tipoAsiento))
            return (
              <TabsContent key={g.id} value={g.id} className="flex flex-col gap-4 pt-2">
                {delGrupo.length === 0 ? (
                  <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                    No hay asientos de {g.titulo.toLowerCase()} en {periodo}.
                  </p>
                ) : delGrupo.map((a) => (
                  <SeccionAsiento key={a.tipoAsiento} asiento={a} periodo={periodo} puedeExportar={puedeExportar}
                    alExportar={(origen) => dialogo.abrir(a, origen)} />
                ))}
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      <HistorialExportaciones anio={anio} />

      {puedeExportar && dialogo.datos && (
        <DialogoExportarWinConta key={dialogo.apertura} anio={anio} mes={mes} asiento={dialogo.datos}
          abierto={dialogo.abierto} alCambiarAbierto={dialogo.cambiarAbierto} focoAlCerrar={dialogo.disparador} />
      )}
    </div>
  )
}
