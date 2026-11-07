// Combobox de clientes y proveedores (docs/UI-UX.md §4): busca en la API por documento o razón social
// (GET /terceros?q=, 300 ms después de escribir), muestra tipo y número en font-mono y, con permiso, "+ Nuevo"
// abre el alta con validación del RUC en vivo. Al crear, el nuevo queda elegido.
import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { ChevronsUpDownIcon, PlusIcon } from 'lucide-react'
import { cn } from 'cn'
import { useTerceros, type RolTercero, type Tercero } from '@/api/terceros'
import { Button } from '@/componentes/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/componentes/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/componentes/ui/popover'
import { Spinner } from '@/componentes/ui/spinner'
import { DialogoTercero } from '@/funcionalidades/maestros/terceros/dialogo-tercero'
import { textoDocumento } from '@/funcionalidades/maestros/terceros/esquemas'
import { mensajeDeError } from '@/lib/errores'
import { usePuede } from '@/lib/roles'

export const ESPERA_BUSQUEDA_MS = 300

type Props = {
  /** id del botón (para el <label htmlFor>). */
  id: string
  /** Basta con el resumen (id, documento y razón social): así sirve también el tercero de un comprobante. */
  valor: Pick<Tercero, 'id' | 'tipoDocumento' | 'numeroDocumento' | 'razonSocial'> | null
  alCambiar: (tercero: Tercero | null) => void
  /** Solo proveedores o solo clientes. */
  rol?: RolTercero
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  deshabilitado?: boolean
  /** Ref del botón (react-hook-form lo usa para enfocar el campo con error). */
  ref?: Ref<HTMLButtonElement>
  /**
   * Texto corto cuando no hay nada elegido (en filtros angostos: "RUC o razón social"). El texto completo
   * ("Buscar … por RUC o razón social") queda como descripción accesible del combobox.
   */
  textoVacio?: string
}

export function SelectorTercero({ id, valor, alCambiar, rol, deshabilitado, ref, textoVacio, ...aria }: Props) {
  const idLista = useId()
  const idAyuda = useId()
  const disparador = useRef<HTMLButtonElement>(null)
  const puedeCrear = usePuede('terceros:editar')
  const [abierto, setAbierto] = useState(false)
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  // Cada "+ Nuevo" monta un formulario limpio.
  const [apertura, setApertura] = useState(0)
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    const temporizador = setTimeout(() => setQ(texto.trim()), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [texto])

  const consulta = useTerceros({ q: q || undefined, rol, pagina: 1, tamano: 20 }, abierto)
  const terceros = consulta.data?.datos.filter((t) => t.activo) ?? []
  const etiquetaRol = rol === 'CLIENTE' ? 'cliente' : rol === 'PROVEEDOR' ? 'proveedor' : 'cliente o proveedor'
  const textoCompleto = `Buscar ${etiquetaRol} por RUC o razón social`
  const describir = !!textoVacio && !valor
  const descripcion = [aria['aria-describedby'], describir ? idAyuda : null].filter(Boolean).join(' ') || undefined

  return (
    <>
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            ref={(boton: HTMLButtonElement | null) => {
              disparador.current = boton
              if (typeof ref === 'function') ref(boton)
              else if (ref) ref.current = boton
            }}
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={abierto}
            aria-controls={abierto ? idLista : undefined}
            disabled={deshabilitado}
            // min-w-0 + truncate: el texto nunca desborda el botón (se corta con "…"), en escritorio ni en celular.
            className={cn('h-9 w-full min-w-0 justify-between font-normal', !valor && 'text-muted-foreground')}
            {...aria}
            aria-describedby={descripcion}
          >
            {valor ? (
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 font-mono text-xs">{textoDocumento(valor)}</span>
                <span className="truncate">{valor.razonSocial}</span>
              </span>
            ) : (
              <span className="min-w-0 truncate">{textoVacio ?? textoCompleto}</span>
            )}
            <ChevronsUpDownIcon aria-hidden="true" className="shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {describir && <span id={idAyuda} className="sr-only">{textoCompleto}</span>}
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
          <Command shouldFilter={false} label={`Buscar ${etiquetaRol}`}>
            <CommandInput value={texto} onValueChange={setTexto} placeholder="RUC, DNI o razón social…" aria-label={`Buscar ${etiquetaRol}`} />
            <CommandList id={idLista}>
              {consulta.isFetching && (
                <div role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Spinner aria-hidden="true" className="size-3.5" /> Buscando…
                </div>
              )}
              {consulta.isError && (
                <div role="alert" className="px-3 py-2 text-xs text-destructive">{mensajeDeError(consulta.error)}</div>
              )}
              {!consulta.isFetching && !consulta.isError && <CommandEmpty>No encontramos ningún {etiquetaRol}.</CommandEmpty>}
              <CommandGroup>
                {terceros.map((tercero) => (
                  <CommandItem
                    key={tercero.id}
                    value={String(tercero.id)}
                    data-checked={valor?.id === tercero.id}
                    onSelect={() => {
                      alCambiar(tercero)
                      setAbierto(false)
                    }}
                  >
                    <span className="w-32 shrink-0 font-mono text-xs">{textoDocumento(tercero)}</span>
                    <span className="truncate">{tercero.razonSocial}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          {puedeCrear && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setAbierto(false)
                  setApertura((n) => n + 1)
                  setNuevoAbierto(true)
                }}
              >
                <PlusIcon aria-hidden="true" />
                Nuevo {etiquetaRol}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {puedeCrear && (
        <DialogoTercero
          key={apertura}
          abierto={nuevoAbierto}
          alCambiarAbierto={setNuevoAbierto}
          rolInicial={rol}
          alGuardar={alCambiar}
          focoAlCerrar={disparador}
        />
      )}
    </>
  )
}
