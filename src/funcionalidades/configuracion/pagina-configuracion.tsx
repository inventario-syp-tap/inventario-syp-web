// Configuración (docs/UI-UX.md §5.17). Ver: ADMIN y CONTADOR. ADMIN edita todo; CONTADOR solo Libro 12.1 y
// WinConta: Empresa y Toma de inventario se le muestran en solo lectura (la API igual responde 403).
// Las pestañas quedan montadas (forceMount + hidden): cambiar de pestaña no borra lo que aún no se guardó.
import { useState } from 'react'
import { PestanaEmpresa } from './pestana-empresa'
import { PestanaLibro } from './pestana-libro'
import { PestanaToma } from './pestana-toma'
import { PestanaWinconta } from './pestana-winconta'
import { useConfiguracion } from '@/api/configuracion'
import { useTituloPagina } from '@/app/titulo-pagina'
import { EncabezadoPagina } from '@/componentes/comunes/encabezado-pagina'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/componentes/ui/tabs'
import { mensajeDeError } from '@/lib/errores'
import { usePuede } from '@/lib/roles'

export function PaginaConfiguracion() {
  useTituloPagina('Configuración')
  const configuracion = useConfiguracion()
  const [pestana, setPestana] = useState<string | null>(null)
  const permisos = {
    empresa: usePuede('configuracion:empresa'),
    libro: usePuede('configuracion:libro'),
    winconta: usePuede('configuracion:winconta'),
    toma: usePuede('configuracion:toma'),
  }

  // Sin elegir: ADMIN abre en Empresa; CONTADOR, en Libro 12.1 (lo que sí puede editar).
  const activa = pestana ?? (permisos.empresa ? 'empresa' : 'libro')

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Configuración" descripcion="Cada pestaña se guarda por separado." />
      {configuracion.isError && <EstadoError mensaje={mensajeDeError(configuracion.error)} alReintentar={() => void configuracion.refetch()} />}
      {configuracion.isPending && (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <Skeleton className="h-9 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {configuracion.data && (
        <Tabs value={activa} onValueChange={setPestana} className="flex flex-col gap-4">
          <TabsList aria-label="Secciones de la configuración" className="w-fit">
            <TabsTrigger value="empresa">Empresa{!permisos.empresa && <span className="sr-only"> (solo lectura)</span>}</TabsTrigger>
            <TabsTrigger value="libro">Libro 12.1</TabsTrigger>
            <TabsTrigger value="winconta">WinConta</TabsTrigger>
            <TabsTrigger value="toma">Toma de inventario{!permisos.toma && <span className="sr-only"> (solo lectura)</span>}</TabsTrigger>
          </TabsList>
          <TabsContent value="empresa" forceMount hidden={activa !== 'empresa'}><PestanaEmpresa configuracion={configuracion.data} editable={permisos.empresa} /></TabsContent>
          <TabsContent value="libro" forceMount hidden={activa !== 'libro'}><PestanaLibro configuracion={configuracion.data} editable={permisos.libro} /></TabsContent>
          <TabsContent value="winconta" forceMount hidden={activa !== 'winconta'}><PestanaWinconta configuracion={configuracion.data} editable={permisos.winconta} /></TabsContent>
          <TabsContent value="toma" forceMount hidden={activa !== 'toma'}><PestanaToma configuracion={configuracion.data} editable={permisos.toma} /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}
