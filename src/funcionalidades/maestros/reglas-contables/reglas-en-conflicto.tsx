// Ante 409 VIGENCIA_SUPERPUESTA, el diálogo muestra junto al mensaje la vigencia pedida y las de las demás reglas
// del mismo tipo, producto y operación (docs/UI-UX.md §5.16), para ver con cuál se cruza. La API ya decidió el
// cruce: aquí solo se listan sus fechas.
import { formatearVigencia, NOMBRE_TIPO_ASIENTO } from './esquemas'
import type { ReglaContable, TipoAsiento } from '@/api/reglas-contables'

type Props = {
  reglas: readonly ReglaContable[]
  tipoAsiento: TipoAsiento
  productoId: number
  tipoOperacion: string
  vigenteDesde: string
  vigenteHasta: string | null
  /** Al editar, la propia regla no se lista. */
  excluirId?: number
}

export function ReglasEnConflicto({ reglas, tipoAsiento, productoId, tipoOperacion, vigenteDesde, vigenteHasta, excluirId }: Props) {
  const mismas = reglas.filter((r) =>
    r.id !== excluirId && r.tipoAsiento === tipoAsiento && r.productoId === productoId && r.tipoOperacion === tipoOperacion)
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p>
        <span className="font-medium">Vigencia que intentaste:</span> {formatearVigencia(vigenteDesde, vigenteHasta)}
      </p>
      {mismas.length > 0 && (
        <>
          <p className="mt-2 font-medium">
            Otras reglas de {NOMBRE_TIPO_ASIENTO[tipoAsiento].toLowerCase()}, operación {tipoOperacion}, del mismo producto:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {mismas.map((r) => (
              <li key={r.id}>
                <span className="font-mono">{r.codigo}</span>: {formatearVigencia(r.vigenteDesde, r.vigenteHasta)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">Cierra la anterior con «Cerrar regla» (vigente hasta) o cambia las fechas.</p>
        </>
      )}
    </div>
  )
}
