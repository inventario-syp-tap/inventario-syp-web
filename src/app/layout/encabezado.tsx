// Barra superior: migas de pan, chip del estado del mes en curso (enlaza a Periodos) y menú de usuario
// (Cambiar contraseña, Tema, Salir). El selector del periodo de trabajo (docs/UI-UX.md §3) queda para otro sprint.
import { Link, useNavigate } from 'react-router'
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon, MoonIcon, SunIcon, UserIcon } from 'lucide-react'
import { RAIZ_MODULO } from '../paginas'
import { useTema } from '../tema'
import { cerrarSesion } from '@/api/auth'
import { useEstadoMes } from '@/api/periodos'
import { ChipEstadoPeriodo } from '@/componentes/comunes/chip-estado-periodo'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/componentes/ui/breadcrumb'
import { Button } from '@/componentes/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/componentes/ui/dropdown-menu'
import { Separator } from '@/componentes/ui/separator'
import { SidebarTrigger } from '@/componentes/ui/sidebar'
import { formatearPeriodo, hoyIso } from '@/lib/formato'
import { TEXTO_ESTADO_PERIODO } from '@/lib/periodos'
import { useSesion } from '@/lib/sesion'

export function Encabezado({ titulo }: { titulo: string }) {
  const { usuario } = useSesion()
  const { tema, alternarTema } = useTema()
  const navegar = useNavigate()
  const esInicio = titulo === 'Inicio'
  const mesEnCurso = useEstadoMes(hoyIso())

  const salir = async () => {
    await cerrarSesion()
    navegar('/login', { replace: true })
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {esInicio ? (
            <BreadcrumbItem>
              <BreadcrumbPage>Inicio</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to={RAIZ_MODULO}>Inicio</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{titulo}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {mesEnCurso && (
          <Link to={`${RAIZ_MODULO}/periodos`}
            aria-label={`Mes en curso: ${formatearPeriodo(mesEnCurso.anio, mesEnCurso.mes)}, ${TEXTO_ESTADO_PERIODO[mesEnCurso.estado]}. Ir a Periodos`}
            className="hidden rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex">
            <ChipEstadoPeriodo estado={mesEnCurso.estado} prefijo={formatearPeriodo(mesEnCurso.anio, mesEnCurso.mes)} />
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Menú de usuario: ${usuario?.nombre ?? ''}`}>
              <UserIcon aria-hidden="true" />
              <span className="max-w-48 truncate">{usuario?.nombre}</span>
              <ChevronDownIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col">
              <span>{usuario?.nombre}</span>
              <span className="text-xs font-normal text-muted-foreground">{usuario?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navegar('/cambiar-password')}>
              <KeyRoundIcon aria-hidden="true" />
              Cambiar contraseña
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={alternarTema}>
              {tema === 'dark' ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
              {tema === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void salir()}>
              <LogOutIcon aria-hidden="true" />
              Salir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
