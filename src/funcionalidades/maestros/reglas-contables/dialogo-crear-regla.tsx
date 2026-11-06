// Nueva regla contable (docs/UI-UX.md §5.16): todos los campos. Tipo, producto, operación y cuentas no se podrán
// cambiar después (para otras cuentas se cierra la regla y se crea otra). El código RC-nn lo asigna la API.
import { useEffect, useId, useState, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  aCrear, CAMPOS_CREAR_REGLA, esquemaCrearRegla, NOMBRE_OPERACION, NOMBRE_TIPO_ASIENTO, OPERACIONES_POR_ASIENTO,
  TIPOS_ASIENTO, valoresCrear, type FormularioCrearRegla,
} from './esquemas'
import { ReglasEnConflicto } from './reglas-en-conflicto'
import { useCatalogos } from '@/api/catalogos'
import { CLAVES } from '@/api/claves'
import { useProductos } from '@/api/productos'
import { crearRegla, type ReglaContable } from '@/api/reglas-contables'
import { Campo } from '@/componentes/comunes/campo'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { DialogoFormulario } from '@/componentes/comunes/dialogo-formulario'
import { Input } from '@/componentes/ui/input'
import { codigoDeError } from '@/lib/errores'
import { aplicarErrorDeApi } from '@/lib/formularios'

type Props = {
  abierto: boolean
  alCambiarAbierto: (abierto: boolean) => void
  reglas: readonly ReglaContable[]
  focoAlCerrar?: RefObject<HTMLElement | null>
}

export function DialogoCrearRegla({ abierto, alCambiarAbierto, reglas, focoAlCerrar }: Props) {
  const id = useId()
  const clienteConsultas = useQueryClient()
  const productos = useProductos()
  const catalogos = useCatalogos()
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [conflicto, setConflicto] = useState<FormularioCrearRegla | null>(null)
  // La página le cambia la `key` en cada apertura: el formulario nace limpio.
  const { register, handleSubmit, control, setValue, getValues, setError, formState: { errors } } = useForm<FormularioCrearRegla>({
    resolver: zodResolver(esquemaCrearRegla),
    defaultValues: valoresCrear(),
  })

  // Al cambiar el tipo de asiento, la operación pasa a la primera que le corresponde.
  const tipoAsiento = useWatch({ control, name: 'tipoAsiento' })
  const permitidas = OPERACIONES_POR_ASIENTO[tipoAsiento]
  useEffect(() => {
    if (!permitidas.includes(getValues('tipoOperacion'))) setValue('tipoOperacion', permitidas[0])
  }, [permitidas, getValues, setValue])

  const guardar = useMutation({
    mutationFn: (datos: FormularioCrearRegla) => crearRegla(aCrear(datos)),
    onSuccess: (regla) => {
      void clienteConsultas.invalidateQueries({ queryKey: CLAVES.reglas })
      toast.success(`Regla ${regla.codigo} registrada`)
      alCambiarAbierto(false)
    },
    onError: (error, datos) => {
      setConflicto(codigoDeError(error) === 'VIGENCIA_SUPERPUESTA' ? datos : null)
      setErrorEnvio(aplicarErrorDeApi(error, setError, CAMPOS_CREAR_REGLA))
    },
  })

  const enviar = handleSubmit((datos) => {
    setErrorEnvio(null)
    setConflicto(null)
    guardar.mutate(datos)
  })

  const operaciones = catalogos.data?.tiposOperacion ?? []
  const opcionesOperacion = permitidas.map((codigo) => ({
    valor: codigo,
    texto: `${codigo} · ${operaciones.find((o) => o.codigo === codigo)?.descripcion ?? NOMBRE_OPERACION[codigo]}`,
  }))
  const opcionesProducto = (productos.data ?? []).filter((p) => p.activo)
    .map((p) => ({ valor: String(p.id), texto: `${p.codigo} · ${p.descripcion}` }))

  return (
    <DialogoFormulario
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      titulo="Nueva regla contable"
      descripcion="Tipo, producto, operación y cuentas no se podrán cambiar después: para otras cuentas se cierra la regla y se crea una nueva."
      alEnviar={enviar}
      enviando={guardar.isPending}
      errorEnvio={errorEnvio}
      detalleError={conflicto && (
        <ReglasEnConflicto
          reglas={reglas}
          tipoAsiento={conflicto.tipoAsiento}
          productoId={Number.parseInt(conflicto.productoId, 10)}
          tipoOperacion={conflicto.tipoOperacion}
          vigenteDesde={conflicto.vigenteDesde}
          vigenteHasta={conflicto.vigenteHasta || null}
        />
      )}
      focoAlCerrar={focoAlCerrar}
      amplio
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id={`${id}-tipo`} etiqueta="Tipo de asiento" error={errors.tipoAsiento?.message}>
          {(a) => <CampoSelect {...a} opciones={TIPOS_ASIENTO.map((t) => ({ valor: t, texto: NOMBRE_TIPO_ASIENTO[t] }))} {...register('tipoAsiento')} />}
        </Campo>
        <Campo id={`${id}-producto`} etiqueta="Producto" error={errors.productoId?.message}>
          {(a) => <CampoSelect {...a} vacio="Elige el producto" opciones={opcionesProducto} {...register('productoId')} />}
        </Campo>
        <Campo id={`${id}-operacion`} etiqueta="Operación (Tabla 12)" error={errors.tipoOperacion?.message}
          ayuda="Solo las que corresponden al tipo de asiento.">
          {(a) => <CampoSelect {...a} opciones={opcionesOperacion} {...register('tipoOperacion')} />}
        </Campo>
        <div className="hidden sm:block" />
        <Campo id={`${id}-debe`} etiqueta="Cuenta Debe" error={errors.cuentaDebe?.message} ayuda="De 2 a 12 dígitos.">
          {(a) => <Input {...a} inputMode="numeric" autoComplete="off" className="h-9 font-mono" {...register('cuentaDebe')} />}
        </Campo>
        <Campo id={`${id}-haber`} etiqueta="Cuenta Haber" error={errors.cuentaHaber?.message} ayuda="De 2 a 12 dígitos.">
          {(a) => <Input {...a} inputMode="numeric" autoComplete="off" className="h-9 font-mono" {...register('cuentaHaber')} />}
        </Campo>
        <Campo id={`${id}-desde`} etiqueta="Vigente desde (AAAA-MM)" error={errors.vigenteDesde?.message} ayuda="Mes incluido.">
          {(a) => <Input {...a} placeholder="2026-01" inputMode="numeric" maxLength={7} autoComplete="off" className="h-9 font-mono" {...register('vigenteDesde')} />}
        </Campo>
        <Campo id={`${id}-hasta`} etiqueta="Vigente hasta (AAAA-MM, opcional)" error={errors.vigenteHasta?.message} ayuda="Vacío = sin fin.">
          {(a) => <Input {...a} placeholder="sin fin" inputMode="numeric" maxLength={7} autoComplete="off" className="h-9 font-mono" {...register('vigenteHasta')} />}
        </Campo>
        <Campo id={`${id}-decision`} etiqueta="Decisión (sustento)" error={errors.decision?.message} ayuda="Código de la decisión, p. ej. D-xx o PC-xx.">
          {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('decision')} />}
        </Campo>
        <Campo id={`${id}-descripcion`} etiqueta="Descripción" error={errors.descripcion?.message}>
          {(a) => <Input {...a} autoComplete="off" className="h-9" {...register('descripcion')} />}
        </Campo>
      </div>
    </DialogoFormulario>
  )
}
