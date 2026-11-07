// Importación y paridad (docs/UI-UX.md §5.19, solo ADMIN). Las dos operaciones tardan de 1 a 3 minutos:
// botones bloqueados mientras corren (sin doble envío) y un mensaje que se anuncia a los lectores de pantalla.
// Se bloquean con aria-disabled y no con disabled: así el foco no salta a <body> (docs/UI-UX.md §7).
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListChecksIcon, UploadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Aviso } from '@/componentes/comunes/aviso'
import { ResumenCarga } from './resumen-carga'
import { TablaParidad } from './tabla-paridad'
import { CLAVES, CLAVES_AFECTADAS_POR_ESCRITURA } from '@/api/claves'
import { cargarHistorico, verificarParidad } from '@/api/importacion'
import { useTituloPagina } from '@/app/titulo-pagina'
import { DialogoConfirmacion } from '@/componentes/comunes/dialogo-confirmacion'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Button } from '@/componentes/ui/button'
import { Skeleton } from '@/componentes/ui/skeleton'
import { Spinner } from '@/componentes/ui/spinner'
import { ErrorApi, mensajeDeError, SIN_RESPUESTA } from '@/lib/errores'
import { formatearEntero } from '@/lib/formato'

const codigoDe = (error: unknown) => (error instanceof ErrorApi ? error.codigo : null)

const BLOQUEADO = 'aria-disabled:pointer-events-none aria-disabled:opacity-50'

type Operacion = 'carga' | 'paridad'

const AVISO_DEMO = 'En la base de demostración no hay histórico ni resultados de referencia: estas operaciones solo funcionan con la base de la empresa.'

function ResultadoCarga({ error, alReintentar }: { error: unknown; alReintentar: () => void }) {
  switch (codigoDe(error)) {
    case 'HISTORICO_YA_CARGADO':
      return (
        <Aviso tono="info" titulo="El histórico ya estaba cargado">
          {mensajeDeError(error)} Repetir la carga no duplica nada; usa «Verificar paridad» para revisarlo.
        </Aviso>
      )
    case 'NO_DISPONIBLE_EN_DEMO':
      return <Aviso tono="advertencia" titulo="No disponible en la base de demostración">{AVISO_DEMO}</Aviso>
    // 502 del proxy, 504 o tiempo agotado: la API pudo recibirla y seguir trabajando. No es un error todavía.
    case SIN_RESPUESTA:
      return (
        <Aviso tono="advertencia" titulo="El servidor no respondió a tiempo">
          La carga puede seguir procesándose en el servidor. Espera 2–3 minutos y pulsa «Verificar paridad»; si vuelves
          a pulsar «Cargar histórico» y ya terminó, verás «El histórico ya estaba cargado» (no se duplica).
        </Aviso>
      )
    default:
      return <EstadoError mensaje={mensajeDeError(error)} alReintentar={alReintentar} />
  }
}

function EsqueletoTabla() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
    </div>
  )
}

export function PaginaImportacion() {
  useTituloPagina('Importación y paridad')
  const clienteConsultas = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)
  const [ultima, setUltima] = useState<Operacion | null>(null)
  const refCargar = useRef<HTMLButtonElement>(null)
  const refParidad = useRef<HTMLButtonElement>(null)

  const carga = useMutation({
    mutationFn: cargarHistorico,
    onSuccess: async () => {
      toast.success('Histórico cargado')
      // Una paridad anterior ya no vale; kardex, stock, dashboard, periodos y comprobantes cambiaron.
      clienteConsultas.removeQueries({ queryKey: CLAVES.paridad })
      await Promise.all(CLAVES_AFECTADAS_POR_ESCRITURA.map((queryKey) => clienteConsultas.invalidateQueries({ queryKey })))
    },
  })

  // Solo se consulta al pulsar el botón (es pesada): enabled false + refetch.
  const paridad = useQuery({ queryKey: CLAVES.paridad, queryFn: verificarParidad, enabled: false, retry: false })

  const ocupado = carga.isPending || paridad.isFetching
  const verificar = () => {
    if (ocupado) return
    setUltima('paridad')
    void paridad.refetch()
  }
  // «Reintentar» desaparece con el esqueleto: el foco pasa antes al botón «Verificar paridad».
  const reintentarParidad = () => {
    refParidad.current?.focus()
    verificar()
  }
  const confirmarCarga = () => {
    setConfirmando(false)
    setUltima('carga')
    carga.mutate()
  }

  // El resultado aparece fuera de esta región; aquí se repite en una frase para que se anuncie al terminar.
  const anuncio = (() => {
    if (carga.isPending) return 'Cargando el histórico. Puede tardar de 1 a 3 minutos; no cierres esta pestaña.'
    if (paridad.isFetching) return 'Verificando la paridad. Puede tardar de 1 a 3 minutos.'
    if (ultima === 'carga' && carga.isSuccess) return 'Terminó la carga del histórico.'
    if (ultima === 'carga' && carga.isError) return 'Terminó la carga del histórico sin completarse; revisa el aviso.'
    if (ultima === 'paridad' && paridad.isError) return 'Terminó la verificación de paridad con un aviso; revísalo.'
    if (ultima === 'paridad' && paridad.data) {
      const total = paridad.data.totalDiferencias
      return total === 0
        ? 'Terminó la verificación de paridad: todo coincide.'
        : `Terminó la verificación de paridad: ${formatearEntero(total)} diferencias.`
    }
    return ''
  })()

  return (
    <section aria-labelledby="titulo-pagina" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 id="titulo-pagina" className="text-xl font-semibold">Importación de datos históricos</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Carga una sola vez los datos 2024–2026 incluidos en el servidor y comprueba que el sistema obtiene los mismos
            resultados que los cuadros de referencia. Repetir la carga no duplica nada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            ref={refCargar}
            type="button"
            aria-disabled={ocupado}
            className={BLOQUEADO}
            onClick={() => !ocupado && setConfirmando(true)}
          >
            {carga.isPending ? <Spinner aria-hidden="true" /> : <UploadIcon aria-hidden="true" />}
            {carga.isPending ? 'Cargando histórico…' : 'Cargar histórico 2024–2026'}
          </Button>
          <Button
            ref={refParidad}
            type="button"
            variant="outline"
            aria-disabled={ocupado}
            className={BLOQUEADO}
            onClick={verificar}
          >
            {paridad.isFetching ? <Spinner aria-hidden="true" /> : <ListChecksIcon aria-hidden="true" />}
            {paridad.isFetching ? 'Verificando paridad…' : 'Verificar paridad'}
          </Button>
        </div>
      </div>

      <div aria-live="polite" className={ocupado ? 'text-sm text-muted-foreground' : 'sr-only'}>
        {anuncio && <p>{anuncio}</p>}
      </div>

      {carga.isSuccess && <ResumenCarga resultado={carga.data} />}
      {carga.isError && <ResultadoCarga error={carga.error} alReintentar={() => setConfirmando(true)} />}

      <section aria-labelledby="titulo-paridad" className="flex flex-col gap-3">
        <h2 id="titulo-paridad" className="text-base font-semibold">Paridad</h2>
        {paridad.isFetching && !paridad.data ? (
          <EsqueletoTabla />
        ) : paridad.isError && codigoDe(paridad.error) === 'NO_DISPONIBLE_EN_DEMO' ? (
          <Aviso tono="advertencia" titulo="No disponible en la base de demostración">{AVISO_DEMO}</Aviso>
        ) : paridad.isError ? (
          <EstadoError mensaje={mensajeDeError(paridad.error)} alReintentar={reintentarParidad} />
        ) : paridad.data ? (
          <TablaParidad paridad={paridad.data} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Pulsa «Verificar paridad» para comparar kardex, resumen mensual, libro 12.1 y asientos por año y producto.
          </p>
        )}
      </section>

      <DialogoConfirmacion
        abierto={confirmando}
        alCambiarAbierto={setConfirmando}
        titulo="¿Cargar el histórico 2024–2026?"
        descripcion="Se cargarán terceros, saldos iniciales, comprobantes, movimientos y control de tonelaje de 2024 a 2026, y se recalculará el kardex. Solo funciona en una base vacía y puede tardar de 1 a 3 minutos."
        textoConfirmar="Cargar histórico"
        alConfirmar={confirmarCarga}
        focoAlCerrar={refCargar}
      />
    </section>
  )
}
