// Título de la página (20 px) con su descripción y las acciones a la derecha (docs/UI-UX.md §3).
import type { ReactNode, Ref } from 'react'

type Props = {
  titulo: string
  descripcion?: ReactNode
  acciones?: ReactNode
  /** Para devolverle el foco al título cuando desaparece el botón que lo tenía (queda con tabIndex -1). */
  refTitulo?: Ref<HTMLHeadingElement>
}

export function EncabezadoPagina({ titulo, descripcion, acciones, refTitulo }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 ref={refTitulo} tabIndex={refTitulo ? -1 : undefined}
          className="rounded-sm text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {titulo}
        </h1>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}
