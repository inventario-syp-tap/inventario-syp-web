// Alta y edición de un cliente o proveedor (docs/UI-UX.md §5.16). Lo usan la pantalla de terceros y el botón
// "+ Nuevo" de SelectorTercero. Tipo 0 (exterior) no lleva número; la razón social se guarda en mayúsculas.
import { useId, useState, type RefObject } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  aCrear, aEditar, CAMPOS_TERCERO, esquemaTercero, NOMBRE_TIPO_DOCUMENTO, TIPOS_DOCUMENTO, valoresIniciales,
  type FormularioTercero,
} from './esquemas'
import { mensajeDocumentoInvalido, useValidacionDocumento } from './use-validacion-documento'
import { EstadoValidacionDocumento } from './validacion-documento'
import { useCatalogos } from '@/api/catalogos'
import { CLAVES } from '@/api/claves'
import { crearTercero, editarTercero, type RolTercero, type Tercero } from '@/api/terceros'
import { Campo } from '@/componentes/comunes/campo'
import { CampoCasilla } from '@/componentes/comunes/campo-casilla'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Checkbox } from '@/componentes/ui/checkbox'
import { FieldError, FieldLegend, FieldSet } from '@/componentes/ui/field'
import { Input } from '@/componentes/ui/input'
import { Label } from '@/componentes/ui/label'
import { codigoDeError, mensajeDeError } from '@/lib/errores'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  /** Si viene, se edita; si no, se crea. */
  tercero?: Tercero
  /** Al crear desde un selector de proveedor o cliente, el rol ya marcado. */
  rolInicial?: RolTercero
  alGuardar?: (tercero: Tercero) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoTercero({ abierto, alCambiarAbierto, tercero, rolInicial, alGuardar, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const catalogos = useCatalogos()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const formulario = useForm<FormularioTercero>({
    resolver: zodResolver(esquemaTercero),
    defaultValues: valoresIniciales(tercero, rolInicial),
  })
  // Sin efecto de "reinicio": quien lo usa le cambia la `key` en cada apertura y el formulario nace limpio.
  const { register, handleSubmit, control, setError, formState: { errors } } = formulario

  const tipo = useWatch({ control, name: 'tipoDocumento' })
  const numero = useWatch({ control, name: 'numeroDocumento' })
  const validacion = useValidacionDocumento(tipo, numero)

  const guardar = useMutation({
    mutationFn: (datos: FormularioTercero) => (tercero ? editarTercero(tercero.id, aEditar(datos, tercero)) : crearTercero(aCrear(datos))),
    onSuccess: (guardado) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.terceros })
      toast.success(tercero ? `${guardado.razonSocial} actualizado` : `${guardado.razonSocial} registrado`)
      alGuardar?.(guardado)
      alCambiarAbierto(false)
    },
    onError: (error) => {
      const codigo = codigoDeError(error)
      if (codigo === 'TERCERO_DUPLICADO' || codigo === 'RUC_INVALIDO' || codigo === 'DOCUMENTO_INVALIDO') {
        setError('numeroDocumento', { type: 'api', message: mensajeDeError(error) }, { shouldFocus: true })
        setErrorEnvio(null)
        return
      }
      setErrorEnvio(aplicarErrorDeApi(error, setError, CAMPOS_TERCERO))
    },
  })

  const enviar = handleSubmit((datos) => {
    setErrorEnvio(null)
    // Si la validación en vivo ya dijo que no es válido, no se envía.
    if (datos.tipoDocumento !== '0' && validacion.listo && validacion.data && !validacion.data.valido) {
      setError('numeroDocumento', { type: 'api', message: mensajeDocumentoInvalido(validacion.data) }, { shouldFocus: true })
      return
    }
    guardar.mutate(datos)
  })

  const tiposCatalogo = catalogos.data?.tiposDocumentoIdentidad ?? []
  const opcionesTipo = TIPOS_DOCUMENTO.map((codigo) => {
    const delCatalogo = tiposCatalogo.find((item) => item.codigo === codigo)
    return { valor: codigo, texto: `${codigo} · ${delCatalogo?.descripcion ?? NOMBRE_TIPO_DOCUMENTO[codigo]}` }
  })
  const sinNumero = tipo === '0'

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo={tercero ? 'Editar cliente o proveedor' : 'Nuevo cliente o proveedor'}
      alEnviar={enviar}
      enviando={guardar.isPending}
      errorEnvio={errorEnvio}
      focoAlCerrar={focoAlCerrar}
      amplio
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${id}-tipo`} etiqueta="Tipo de documento (Tabla 2)" error={errors.tipoDocumento?.message}>
          {(a) => <CampoSelect {...a} opciones={opcionesTipo} {...register('tipoDocumento')} />}
        </Campo>
        {sinNumero ? (
          <div className="flex flex-col justify-end gap-1 text-sm text-muted-foreground">
            <p>Cliente del exterior u otros: se registra sin número de documento.</p>
          </div>
        ) : (
          <Campo
            id={`${id}-numero`}
            etiqueta="Número de documento"
            error={errors.numeroDocumento?.message}
            ayuda={tipo === '6' ? '11 dígitos; se revisa el dígito verificador.' : tipo === '1' ? '8 dígitos.' : undefined}
          >
            {(a) => (
              <>
                <Input
                  {...a}
                  aria-describedby={[a['aria-describedby'], `${id}-validacion`].filter(Boolean).join(' ')}
                  inputMode={tipo === '6' || tipo === '1' ? 'numeric' : 'text'}
                  autoComplete="off"
                  className="h-9 font-mono"
                  {...register('numeroDocumento')}
                />
                <EstadoValidacionDocumento id={`${id}-validacion`} validacion={validacion} terceroActualId={tercero?.id} />
              </>
            )}
          </Campo>
        )}
        <Campo id={`${id}-razon`} etiqueta="Razón social o nombre" error={errors.razonSocial?.message} className="sm:col-span-2"
          ayuda="Se guarda en mayúsculas.">
          {(a) => <Input {...a} autoComplete="off" className="h-9 uppercase" {...register('razonSocial')} />}
        </Campo>
        <Campo id={`${id}-pais`} etiqueta="País" error={errors.pais?.message} ayuda="Código de 2 letras (PE, US…).">
          {(a) => <Input {...a} maxLength={2} autoComplete="off" className="h-9 uppercase" {...register('pais')} />}
        </Campo>
        <Campo id={`${id}-direccion`} etiqueta="Dirección (opcional)" error={errors.direccion?.message}>
          {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('direccion')} />}
        </Campo>
      </div>

      <FieldSet aria-describedby={errors.esProveedor ? `${id}-rol-error` : undefined}>
        <FieldLegend variant="label">Rol</FieldLegend>
        <div className="flex flex-wrap gap-6">
          {(['esProveedor', 'esCliente'] as const).map((campo) => (
            <Controller
              key={campo}
              control={control}
              name={campo}
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`${id}-${campo}`}
                    ref={field.ref}
                    checked={field.value}
                    onCheckedChange={(valor) => field.onChange(valor === true)}
                    onBlur={field.onBlur}
                    aria-invalid={!!errors.esProveedor}
                    aria-describedby={errors.esProveedor ? `${id}-rol-error` : undefined}
                  />
                  <Label htmlFor={`${id}-${campo}`}>{campo === 'esProveedor' ? 'Proveedor' : 'Cliente'}</Label>
                </div>
              )}
            />
          ))}
        </div>
        <FieldError id={`${id}-rol-error`} errors={errors.esProveedor ? [errors.esProveedor] : []} />
      </FieldSet>
      {tercero && (
        <Controller
          control={control}
          name="activo"
          render={({ field }) => (
            <CampoCasilla id={`${id}-activo`} etiqueta="Activo" ref={field.ref} marcado={field.value} alCambiar={field.onChange} />
          )}
        />
      )}
    </DialogoFormulario>
  )
}
