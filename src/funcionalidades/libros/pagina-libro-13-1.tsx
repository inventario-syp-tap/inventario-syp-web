// Libro 13.1 — valorizado (docs/UI-UX.md §5.12). Todos ven. Filtros como el kardex (producto o todos, año, mes o
// todo el año) y descarga en PDF y Excel. «Detallado» (RUC, razón social y descripción) solo para ADMIN y CONTADOR
// (D-33, Ley 29733): a los demás no se les muestra ni se envía. Sin tabla en pantalla: esa vista es el Kardex.
import { Link } from 'react-router'
import { FileSpreadsheetIcon, FileTextIcon } from 'lucide-react'
import { FiltrosLibro } from './filtros-libro'
import { useFiltrosLibro } from './use-filtros-libro'
import { rutaLibro131 } from '@/api/libros'
import { RAIZ_MODULO } from '@/app/paginas'
import { useTituloPagina } from '@/app/titulo-pagina'
import { BotonDescarga } from '@/componentes/comunes/boton-descarga'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { formatearPeriodo } from '@/lib/formato'
import { usePuede } from '@/lib/roles'
import { escribirFiltrosKardex } from '@/funcionalidades/kardex/filtros-url'

export function PaginaLibro131() {
  useTituloPagina('Libro 13.1')
  const { filtros, paraApi, cambiar } = useFiltrosLibro()
  const puedeDetallado = usePuede('libros:13-1-detallado')
  const detallado = puedeDetallado && filtros.detallado
  const textoPeriodo = filtros.mes === null ? `todo ${filtros.anio}` : formatearPeriodo(filtros.anio, filtros.mes)
  const base = `libro-13-1-${filtros.anio}${filtros.mes ? `-${String(filtros.mes).padStart(2, '0')}` : ''}${detallado ? '-detallado' : ''}`

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Libro 13.1"
        descripcion="Registro del inventario permanente valorizado (costo promedio ponderado). Reporte interno."
      />
      <FiltrosLibro filtros={filtros} cambiar={cambiar} conDetallado={puedeDetallado} />
      <div className="flex flex-wrap gap-2">
        <BotonDescarga ruta={rutaLibro131({ ...paraApi, detallado }, 'pdf')} nombrePorDefecto={`${base}.pdf`} variante="default"
          icono={<FileTextIcon aria-hidden="true" />} aria-label={`Descargar PDF del libro 13.1 de ${textoPeriodo}`}>
          Descargar PDF
        </BotonDescarga>
        <BotonDescarga ruta={rutaLibro131({ ...paraApi, detallado }, 'xlsx')} nombrePorDefecto={`${base}.xlsx`}
          icono={<FileSpreadsheetIcon aria-hidden="true" />} aria-label={`Descargar Excel del libro 13.1 de ${textoPeriodo}`}>
          Descargar Excel
        </BotonDescarga>
      </div>
      <p className="text-sm text-muted-foreground">
        Para revisarlo en pantalla, abre el{' '}
        <Link className="text-foreground underline underline-offset-2" to={`${RAIZ_MODULO}/kardex?${escribirFiltrosKardex({ ...filtros, detallado }).toString()}`}>Kardex</Link> con los mismos filtros.
      </p>
    </div>
  )
}
