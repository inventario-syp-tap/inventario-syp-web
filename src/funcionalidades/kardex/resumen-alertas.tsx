// Resumen de GET /kardex/alertas?anio (docs/UI-UX.md §5.8): aviso superior con el conteo por tipo (ícono + texto) y
// la lista desplegable con un enlace a cada fila del kardex (#fila-<movimientoId>). Las alertas las decide la API.
import { Link } from 'react-router'
import { enlaceKardex } from './filtros-url'
import type { Alerta, Alertas } from '@/api/kardex'
import { anioMesDeFecha } from '@/api/periodos'
import { RAIZ_MODULO } from '@/app/paginas'
import { Aviso } from '@/componentes/comunes/aviso'
import { IconoAlerta } from '@/componentes/comunes/icono-alerta'
import { textoAlerta } from '@/lib/alertas'
import { formatearEntero, formatearFecha } from '@/lib/formato'

const MAXIMO_EN_LISTA = 50

function destino(alerta: Alerta): string | null {
  if (alerta.tipo === 'SI_DESACTUALIZADO') return `${RAIZ_MODULO}/saldos-iniciales?anio=${alerta.anio}`
  if (alerta.productoId === null) return null
  const mes = anioMesDeFecha(alerta.fecha)?.mes ?? alerta.mes
  return enlaceKardex(alerta.productoId, alerta.anio, mes, alerta.movimientoId)
}

export function ResumenAlertas({ alertas }: { alertas: Alertas }) {
  const lista = alertas.alertas
  if (lista.length === 0) return null
  const conteo = new Map<string, number>()
  for (const alerta of lista) conteo.set(alerta.tipo, (conteo.get(alerta.tipo) ?? 0) + 1)
  const resumen = [...conteo.entries()].map(([tipo, n]) => `${formatearEntero(n)} ${textoAlerta(tipo).toLowerCase()}`).join(' · ')

  return (
    <Aviso tono="advertencia" titulo={`${formatearEntero(lista.length)} ${lista.length === 1 ? 'alerta' : 'alertas'} en el kardex de ${alertas.anio}`}>
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        {[...conteo.keys()].map((tipo) => <IconoAlerta key={tipo} codigo={tipo} />)}
        <span className="sr-only">{resumen}</span>
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-foreground">Ver la lista ({resumen})</summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {lista.slice(0, MAXIMO_EN_LISTA).map((alerta, i) => {
            const enlace = destino(alerta)
            const texto = [
              alerta.productoCodigo,
              alerta.fecha ? formatearFecha(alerta.fecha) : null,
              alerta.documento,
            ].filter(Boolean).join(' · ')
            return (
              <li key={`${alerta.tipo}-${alerta.movimientoId ?? alerta.productoId ?? 'general'}-${i}`} className="flex flex-wrap items-center gap-2">
                <IconoAlerta codigo={alerta.tipo} />
                {enlace ? (
                  <Link to={enlace} className="font-mono text-xs text-foreground underline underline-offset-2">{texto || 'Ver'}</Link>
                ) : (
                  <span className="font-mono text-xs">{texto}</span>
                )}
                <span className="text-xs">{alerta.mensaje}</span>
              </li>
            )
          })}
        </ul>
        {lista.length > MAXIMO_EN_LISTA && (
          <p className="mt-2 text-xs">Se muestran las primeras {MAXIMO_EN_LISTA}. Elige el producto y el mes para ver el resto en la tabla.</p>
        )}
      </details>
    </Aviso>
  )
}
