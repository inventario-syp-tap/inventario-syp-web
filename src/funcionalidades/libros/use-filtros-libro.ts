// Filtros de los libros en la URL, con el mismo formato que el kardex (?producto&anio&mes=N|todo&detallado=1).
import { useSearchParams } from 'react-router'
import type { FiltrosLibro } from '@/api/libros'
import { escribirFiltrosKardex, leerFiltrosKardex, type FiltrosKardexUrl } from '@/funcionalidades/kardex/filtros-url'

/** Filtros de la URL y su versión para la API (sin mes: año completo; sin producto: todos). */
export function useFiltrosLibro() {
  const [parametros, setParametros] = useSearchParams()
  const filtros = leerFiltrosKardex(parametros)
  const cambiar = (cambios: Partial<FiltrosKardexUrl>) =>
    setParametros(escribirFiltrosKardex({ ...filtros, ...cambios }), { replace: true })
  const paraApi: FiltrosLibro = {
    anio: filtros.anio,
    mes: filtros.mes ?? undefined,
    productoId: filtros.productoId ?? undefined,
  }
  return { filtros, paraApi, cambiar }
}
