// Descarga un PDF o Excel de la API (docs/UI-UX.md §4): muestra "Generando…" con spinner mientras la API arma el
// archivo, lo guarda con el nombre de Content-Disposition y avisa los errores con mensajes claros (403 sin permiso,
// 409 mes no cerrado, 429 límite de descargas por minuto). Mientras descarga queda bloqueado con aria-disabled
// (no `disabled`) para que el foco no salte a <body>.
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { DownloadIcon } from 'lucide-react'
import { descargarArchivo } from '@/api/descargas'
import { Button } from '@/componentes/ui/button'
import { Spinner } from '@/componentes/ui/spinner'
import { mensajeDeDescarga } from '@/lib/descargas'

type Props = {
  /** Ruta de la API con su consulta ("/libros/12-1?anio=2026&mes=1&formato=pdf"). */
  ruta: string
  /** Nombre si la API no manda Content-Disposition. */
  nombrePorDefecto: string
  children: ReactNode
  icono?: ReactNode
  variante?: 'default' | 'outline' | 'secondary'
  /** Nombre accesible si el texto visible no basta ("Descargar el libro 13.1 en Excel"). */
  'aria-label'?: string
}

export function BotonDescarga({ ruta, nombrePorDefecto, children, icono, variante = 'outline', 'aria-label': etiqueta }: Props) {
  const [descargando, setDescargando] = useState(false)

  const descargar = async () => {
    if (descargando) return
    setDescargando(true)
    try {
      const nombre = await descargarArchivo(ruta, nombrePorDefecto)
      toast.success(`Descarga lista: ${nombre}`)
    } catch (error) {
      toast.error(mensajeDeDescarga(error), { duration: Infinity })
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Button type="button" variant={variante} aria-label={descargando && etiqueta ? `Generando… ${etiqueta}` : etiqueta}
      aria-disabled={descargando || undefined} aria-busy={descargando || undefined}
      className="aria-disabled:cursor-wait aria-disabled:opacity-60" onClick={() => void descargar()}>
      {descargando ? <Spinner aria-hidden="true" role={undefined} aria-label={undefined} /> : (icono ?? <DownloadIcon aria-hidden="true" />)}
      {descargando ? 'Generando…' : children}
    </Button>
  )
}
