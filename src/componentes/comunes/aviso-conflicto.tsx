// 409 ORDEN_EN_CONFLICTO o CONFLICTO_CONCURRENTE: otro usuario cambió los mismos datos y la API no guardó nada.
// "Reintentar" VUELVE A CARGAR los datos (invalida las consultas); nunca reenvía la petición a ciegas: la persona
// revisa lo nuevo y decide si guarda otra vez.
import type { Ref } from 'react'
import { RotateCwIcon } from 'lucide-react'
import { Aviso } from './aviso'
import { Button } from '@/componentes/ui/button'
import { MENSAJE_CONFLICTO } from '@/lib/errores'

type Props = { alReintentar: () => void; className?: string; ref?: Ref<HTMLDivElement> }

export function AvisoConflicto({ alReintentar, className, ref }: Props) {
  return (
    <div ref={ref} tabIndex={-1} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Aviso
        tono="error"
        titulo={MENSAJE_CONFLICTO}
        className={className}
        acciones={(
          <Button type="button" variant="outline" size="sm" onClick={alReintentar}>
            <RotateCwIcon aria-hidden="true" />
            Reintentar
          </Button>
        )}
      >
        No se guardó nada. Reintentar vuelve a cargar los datos; revísalos y, si corresponde, vuelve a guardar.
      </Aviso>
    </div>
  )
}
