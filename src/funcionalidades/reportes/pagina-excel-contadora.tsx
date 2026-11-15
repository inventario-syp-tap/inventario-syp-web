// Excel formato contadora (docs/UI-UX.md §5.12; A y C): un .xlsx por año con sus hojas de siempre (TN, COSTO DE
// VENTAS, las hojas anuales por producto y ASIENTO), con valores calculados por la API (no fórmulas).
import { useSearchParams } from 'react-router'
import { FileSpreadsheetIcon } from 'lucide-react'
import { rutaExcelContadora } from '@/api/reportes'
import { useTituloPagina } from '@/app/titulo-pagina'
import { BotonDescarga } from '@/componentes/comunes/boton-descarga'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { SelectorPeriodo } from '@/componentes/comunes/selector-periodo'
import { anioDeUrl } from '@/lib/periodos'

export function PaginaExcelContadora() {
  useTituloPagina('Excel contadora')
  const [parametros, setParametros] = useSearchParams()
  const anio = anioDeUrl(parametros)
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina
        titulo="Excel formato contadora"
        descripcion="Un archivo .xlsx del año con las hojas de siempre (TN, COSTO DE VENTAS, las hojas anuales por producto y ASIENTO), con valores, no fórmulas."
      />
      <div className="flex flex-wrap items-end gap-3">
        <SelectorPeriodo anio={anio} alCambiarAnio={(nuevo) => setParametros({ anio: String(nuevo) }, { replace: true })} />
        <BotonDescarga ruta={rutaExcelContadora(anio)} nombrePorDefecto={`excel-contadora-${anio}.xlsx`} variante="default"
          icono={<FileSpreadsheetIcon aria-hidden="true" />} aria-label={`Descargar Excel formato contadora de ${anio}`}>
          Descargar Excel
        </BotonDescarga>
      </div>
    </div>
  )
}
