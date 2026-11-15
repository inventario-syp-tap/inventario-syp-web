// Un solo camino para descargar archivos de la API (libros 12.1 y 13.1, reportes y Excel contadora): pide el
// archivo por api/cliente.ts y lo guarda con el nombre que manda la API (Content-Disposition).
import { solicitarArchivo } from './cliente'
import { guardarArchivo, nombreDeContentDisposition } from '@/lib/descargas'

/** Descarga `ruta` (relativa a la base de la API) y devuelve el nombre con que se guardó. */
export async function descargarArchivo(ruta: string, nombrePorDefecto: string): Promise<string> {
  const archivo = await solicitarArchivo(ruta)
  const nombre = nombreDeContentDisposition(archivo.contentDisposition) ?? nombrePorDefecto
  guardarArchivo(archivo.blob, nombre)
  return nombre
}
