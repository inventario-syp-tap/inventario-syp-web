// Paso 4 de la toma (A, C): una acción por cada producto con diferencia — MERMA (13; solo faltantes, con el sustento
// del informe técnico), AJUSTE (28; con el sustento del acta) o NINGUNA (con observación) — y «Resolver», que genera
// los comprobantes enlazados (POST /tomas-inventario/:id/resolver, todo de una vez).
// - 409 STOCK_NEGATIVO_REQUIERE_CONFIRMACION → DialogoStockNegativo del S8 y reenvío con la confirmación.
// - 409 TOMA_DESACTUALIZADA (el kardex cambió desde la toma) → aviso con «Volver a calcular»: registra una toma nueva
//   con la misma fecha, responsable y cantidades y abre su detalle (la anterior queda como "Reemplazada").
// - Conflicto entre usuarios → AvisoConflicto (recarga, no reenvía). Lo demás, con su mensaje de docs/UI-UX.md §6.
import { useId, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { RefreshCwIcon } from 'lucide-react'
import { ACCIONES, esquemaResolverToma, MAXIMO_TEXTO, type FormularioResolverToma } from './esquemas'
import { datosParaRecalcular, TEXTO_ACCION } from './utilidades'
import { CLAVES } from '@/api/claves'
import { crearToma, lineasConDiferencia, resolverToma, type DatosResolverToma, type Toma } from '@/api/tomas-inventario'
import { RAIZ_MODULO } from '@/app/paginas'
import { Aviso } from '@/componentes/comunes/aviso'
import { AvisoConflicto } from '@/componentes/comunes/aviso-conflicto'
import { Campo } from '@/componentes/comunes/campo'
import { Cifra } from '@/componentes/comunes/cifra'
import { DialogoStockNegativo } from '@/componentes/comunes/dialogo-stock-negativo'
import { EstadoError } from '@/componentes/comunes/estado-error'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Spinner } from '@/componentes/ui/spinner'
import { Textarea } from '@/componentes/ui/textarea'
import { useEscritura } from '@/funcionalidades/comprobantes/use-escritura'
import { codigoDeError, mensajeDeError } from '@/lib/errores'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = { toma: Toma }

export function FormularioResolver({ toma }: Props) {
  const id = useId()
  const navegar = useNavigate()
  const clienteConsultas = useQueryClient()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [desactualizada, setDesactualizada] = useState(false)
  const conDiferencia = lineasConDiferencia(toma)
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm<FormularioResolverToma>({
    resolver: zodResolver(esquemaResolverToma),
    defaultValues: {
      lineas: conDiferencia.map((l) => ({ productoId: l.productoId, tipoDiferencia: l.tipoDiferencia, accion: '', observacion: '' })),
      sustentoMerma: '',
      anioInforme: toma.fecha.slice(0, 4),
      sustentoAjuste: '',
    },
  })
  const { fields } = useFieldArray({ control, name: 'lineas' })
  const acciones = useWatch({ control, name: 'lineas' }).map((l) => l.accion)
  const hayMerma = acciones.includes('MERMA')
  const hayAjuste = acciones.includes('AJUSTE')

  const escritura = useEscritura<DatosResolverToma, Toma>({
    ejecutar: (cuerpo) => resolverToma(toma.id, cuerpo),
    alExito: (resuelta) => {
      const documentos = resuelta.comprobantes.map((c) => c.documento).join(', ')
      toast.success(`Diferencias resueltas${documentos ? ` · comprobantes ${documentos}` : ''} · kardex recalculado`)
    },
    alError: (error) => {
      const codigo = codigoDeError(error)
      if (codigo === 'TOMA_DESACTUALIZADA') {
        setDesactualizada(true)
        setErrorEnvio(null)
        return
      }
      if (codigo === 'TOMA_YA_RESUELTA' || codigo === 'TOMA_YA_CERRADA') {
        void clienteConsultas.invalidateQueries({ queryKey: CLAVES.tomas })
      }
      setErrorEnvio(aplicarErrorDeApi(error, setError, ['sustentoMerma', 'anioInforme', 'sustentoAjuste']))
    },
  })

  const recalcular = useMutation({
    mutationFn: () => crearToma(datosParaRecalcular(toma)),
    onSuccess: (nueva) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.tomas })
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.dashboard })
      toast.success('Se registró una toma nueva con las mismas cantidades · revisa las diferencias recalculadas')
      void navegar(`${RAIZ_MODULO}/toma-inventario/${nueva.id}`)
    },
    onError: (error) => setErrorEnvio(mensajeDeError(error)),
  })

  const enviar = handleSubmit((valores) => {
    setErrorEnvio(null)
    setDesactualizada(false)
    const merma = valores.lineas.some((l) => l.accion === 'MERMA')
    const ajuste = valores.lineas.some((l) => l.accion === 'AJUSTE')
    escritura.enviar({
      lineas: valores.lineas.map((l) => ({
        productoId: l.productoId,
        accion: l.accion as (typeof ACCIONES)[number],
        ...(l.observacion ? { observacion: l.observacion } : {}),
      })),
      ...(merma ? { sustentoMerma: valores.sustentoMerma, anioInforme: Number.parseInt(valores.anioInforme, 10) } : {}),
      ...(ajuste ? { sustentoAjuste: valores.sustentoAjuste } : {}),
    })
  })

  const ocupado = escritura.enviando || recalcular.isPending
  const productoDelStock = toma.lineas.find((l) => l.productoId === escritura.confirmacion?.productoId)

  return (
    <form noValidate onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4"
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
          evento.preventDefault()
          if (!ocupado) evento.currentTarget.requestSubmit()
        }
      }}>
      {fields.map((campo, i) => {
        const linea = conDiferencia[i]
        const idLinea = `${id}-linea-${i}`
        const errorAccion = errors.lineas?.[i]?.accion?.message
        const errorObservacion = errors.lineas?.[i]?.observacion?.message
        return (
          <fieldset key={campo.id} className="flex flex-col gap-3 rounded-md border p-3"
            aria-describedby={errorAccion ? `${idLinea}-accion-error` : undefined}>
            <legend className="px-1 text-sm font-medium">
              {linea.productoCodigo} · {linea.productoDescripcion}
            </legend>
            <p className="text-sm text-muted-foreground">
              {/* La palabra ya dice el sentido: la cifra va sin el signo (no se calcula nada, se quita del texto). */}
              {linea.tipoDiferencia === 'FALTANTE' ? 'Faltante' : 'Sobrante'} de{' '}
              <Cifra tipo="toneladas" valor={linea.diferencia.replace(/^-/, '')} /> TN (sistema <Cifra tipo="toneladas" valor={linea.cantidadSistema} /> TN ·
              contado <Cifra tipo="toneladas" valor={linea.cantidadContada} /> TN)
              {linea.dentroDeTolerancia && ' · dentro de la tolerancia'}
            </p>
            {/* La merma solo se ofrece con faltantes: así el primer radio siempre está habilitado y recibe el foco del error. */}
            <div role="radiogroup" aria-label={`Acción para ${linea.productoCodigo}`} aria-invalid={!!errorAccion}
              aria-describedby={errorAccion ? `${idLinea}-accion-error` : undefined}
              className="flex flex-wrap gap-x-5 gap-y-2">
              {ACCIONES.filter((accion) => accion !== 'MERMA' || linea.tipoDiferencia === 'FALTANTE').map((accion) => (
                <label key={accion} className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" value={accion} className="size-4 accent-primary" {...register(`lineas.${i}.accion`)} />
                  {TEXTO_ACCION[accion]}
                </label>
              ))}
              {linea.tipoDiferencia !== 'FALTANTE' && (
                <span className="text-xs text-muted-foreground">La merma (13) solo corresponde a faltantes.</span>
              )}
            </div>
            {errorAccion && <p id={`${idLinea}-accion-error`} className="text-sm text-destructive">{errorAccion}</p>}
            <Campo id={`${idLinea}-observacion`} etiqueta="Observación (obligatoria si eliges Ninguna)" error={errorObservacion}>
              {(a) => <Textarea {...a} rows={2} maxLength={MAXIMO_TEXTO} {...register(`lineas.${i}.observacion`)} />}
            </Campo>
          </fieldset>
        )
      })}

      {hayMerma && (
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Campo id={`${id}-sustento-merma`} etiqueta="Sustento de la merma (13)" error={errors.sustentoMerma?.message}
            ayuda="Informe técnico: profesional, colegiatura y fecha.">
            {(a) => <Textarea {...a} rows={2} maxLength={MAXIMO_TEXTO} {...register('sustentoMerma')} />}
          </Campo>
          <Campo id={`${id}-anio-informe`} etiqueta="Año del informe" error={errors.anioInforme?.message}
            ayuda="Documento 00-IT-<año>.">
            {(a) => <Input {...a} {...register('anioInforme')} inputMode="numeric" maxLength={4} className="w-24 tabular-nums" />}
          </Campo>
        </div>
      )}
      {hayAjuste && (
        <Campo id={`${id}-sustento-ajuste`} etiqueta="Sustento del ajuste (28)" error={errors.sustentoAjuste?.message}
          ayuda="Acta de la toma de inventario.">
          {(a) => <Textarea {...a} rows={2} maxLength={MAXIMO_TEXTO} {...register('sustentoAjuste')} />}
        </Campo>
      )}

      {desactualizada && (
        <Aviso tono="advertencia" titulo="El kardex cambió después de registrar esta toma"
          acciones={(
            <Button type="button" size="sm" aria-disabled={ocupado || undefined}
              onClick={() => { if (!ocupado) recalcular.mutate() }}>
              {recalcular.isPending ? <Spinner aria-hidden="true" /> : <RefreshCwIcon aria-hidden="true" />}
              {recalcular.isPending ? 'Calculando…' : 'Volver a calcular'}
            </Button>
          )}>
          Las diferencias ya no son las del saldo actual. «Volver a calcular» registra una toma nueva con la misma fecha,
          responsable y cantidades; esta quedará como reemplazada.
        </Aviso>
      )}
      {escritura.hayConflicto && <AvisoConflicto alReintentar={escritura.recargar} />}
      {errorEnvio && <EstadoError mensaje={errorEnvio} />}

      <div>
        <Button type="submit" aria-disabled={ocupado || undefined} onClick={(e) => { if (ocupado) e.preventDefault() }}>
          {escritura.enviando && <Spinner aria-hidden="true" />}
          {escritura.enviando ? 'Resolviendo…' : 'Resolver diferencias'}
        </Button>
      </div>

      <DialogoStockNegativo
        abierto={escritura.confirmacion !== null}
        alCambiarAbierto={(siguiente) => { if (!siguiente) escritura.cancelarConfirmacion() }}
        detalle={escritura.confirmacion}
        producto={productoDelStock ? `${productoDelStock.productoCodigo} · ${productoDelStock.productoDescripcion}` : null}
        alConfirmar={escritura.confirmar}
      />
    </form>
  )
}
