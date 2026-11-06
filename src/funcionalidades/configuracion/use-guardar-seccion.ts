import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CLAVES } from '@/api/claves'
import { actualizarConfiguracion, type CambiosConfiguracion } from '@/api/configuracion'

/** PATCH /configuracion de una sección: deja la respuesta en la caché y avisa con un toast. */
export function useGuardarSeccion(nombre: string) {
  const clienteConsultas = useQueryClient()
  return useMutation({
    mutationFn: (cambios: CambiosConfiguracion) => actualizarConfiguracion(cambios),
    onSuccess: (configuracion) => {
      clienteConsultas.setQueryData(CLAVES.configuracion, configuracion)
      toast.success(`Configuración de ${nombre} guardada`)
    },
  })
}
