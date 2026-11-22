// Un solo camino para descargar archivos de la API (libros 12.1 y 13.1, reportes, Excel contadora, control de
// tonelaje y WinConta): pide el archivo por api/cliente.ts y lo guarda con el nombre que manda la API
// (Content-Disposition).
import { solicitarArchivo } from './cliente'
import { guardarArchivo, nombreDeContentDisposition } from '@/lib/descargas'

/** Descarga `ruta` (relativa a la base de la API) y devuelve el nombre con que se guardó. */
export async function descargarArchivo(ruta: string, nombrePorDefecto: string): Promise<string> {
  const archivo = await solicitarArchivo(ruta)
  const nombre = nombreDeContentDisposition(archivo.contentDisposition) ?? nombrePorDefecto
  guardarArchivo(archivo.blob, nombre)
  return nombre
}

/**
 * Igual que `descargarArchivo`, pero con POST y cuerpo JSON (la exportación a WinConta registra la exportación y
 * devuelve el .xlsx). Es una escritura: no se repite sola ante un 504.
 */
export async function descargarArchivoPost(ruta: string, cuerpo: unknown, nombrePorDefecto: string): Promise<string> {
  const archivo = await solicitarArchivo(ruta, { metodo: 'POST', cuerpo })
  const nombre = nombreDeContentDisposition(archivo.contentDisposition) ?? nombrePorDefecto
  guardarArchivo(archivo.blob, nombre)
  return nombre
}
