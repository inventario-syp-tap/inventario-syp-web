// Líneas del comprobante (docs/UI-UX.md §5.3): # · Producto · Descripción · Cantidad TN · Costo o valor · Importe.
// Cada control tiene su <label> (oculta: el encabezado de la columna la muestra) con el número de línea, y su error
// asociado con aria-describedby. El importe es una vista previa con big.js. Alt+N agrega una línea (lo maneja el
// formulario); el botón "Quitar" no aparece si solo queda una.
import type { ReactNode } from 'react'
import { Controller, useWatch, type Control, type FieldErrors, type UseFieldArrayReturn, type UseFormRegister } from 'react-hook-form'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { SimulacionLinea } from './simulacion-linea'
import { formatearImporte, importeLinea, llevaPrecio, type FormularioComprobante, type Moneda } from '../esquemas'
import type { Naturaleza } from '@/api/comprobantes'
import { CampoDecimal } from '@/componentes/comunes/campo-decimal'
import { CampoSelect } from '@/componentes/comunes/campo-select'
import { SelectorProducto } from '@/componentes/comunes/selector-producto'
import { Button } from '@/componentes/ui/button'
import { Input } from '@/componentes/ui/input'
import { Kbd } from '@/componentes/ui/kbd'

type Props = {
  idBase: string
  naturaleza: Naturaleza
  control: Control<FormularioComprobante>
  register: UseFormRegister<FormularioComprobante>
  errors: FieldErrors<FormularioComprobante>
  lineas: UseFieldArrayReturn<FormularioComprobante, 'lineas'>
  moneda: Moneda
  fecha: string
  establecimientoId: string
  /** Simular la salida en cada línea (venta nueva). */
  simular: boolean
  alAgregar: () => void
  /** Quita la línea y mueve el foco (lo decide el formulario). */
  alQuitar: (indice: number) => void
}

type AtributosCelda = { id: string; 'aria-invalid': boolean; 'aria-describedby': string | undefined }

/** Celda con etiqueta solo para lectores de pantalla y el error debajo del control. */
function Celda({ id, etiqueta, error, children }: { id: string; etiqueta: string; error?: string; children: (a: AtributosCelda) => ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">{etiqueta}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-error` : undefined })}
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function encabezadoPrecio(naturaleza: Naturaleza, moneda: Moneda): string | null {
  if (naturaleza === 'COMPRA') return 'Costo S/ x TN (sin IGV)'
  if (naturaleza === 'VENTA') return `Valor de venta ${moneda === 'USD' ? 'US$' : 'S/'} x TN (sin IGV)`
  if (naturaleza === 'AJUSTE') return 'Costo S/ x TN'
  return null
}

export function LineasComprobante({
  idBase, naturaleza, control, register, errors, lineas, moneda, fecha, establecimientoId, simular, alAgregar, alQuitar,
}: Props) {
  const valores = useWatch({ control, name: 'lineas' })
  const tituloPrecio = encabezadoPrecio(naturaleza, moneda)
  const conImporte = tituloPrecio !== null
  const esAjuste = naturaleza === 'AJUSTE'
  const errorLineas = errors.lineas?.message ?? errors.lineas?.root?.message

  return (
    <section aria-labelledby={`${idBase}-titulo-lineas`} className="flex flex-col gap-2">
      <h2 id={`${idBase}-titulo-lineas`} className="text-base font-medium">Líneas</h2>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">Líneas del comprobante</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 p-2">#</th>
              <th scope="col" className="w-56 p-2">Producto</th>
              <th scope="col" className="p-2">Descripción / calidad</th>
              {esAjuste && <th scope="col" className="w-32 p-2">Movimiento</th>}
              {esAjuste && <th scope="col" className="w-40 p-2">Valorización</th>}
              <th scope="col" className="w-32 p-2 text-right">Cantidad TN</th>
              {tituloPrecio && <th scope="col" className="w-40 p-2 text-right">{tituloPrecio}</th>}
              {conImporte && <th scope="col" className="w-36 p-2 text-right">Importe (vista previa)</th>}
              <th scope="col" className="w-12 p-2"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {lineas.fields.map((campo, i) => {
              const n = i + 1
              const actual = valores?.[i] ?? campo
              const errorLinea = errors.lineas?.[i]
              const conPrecio = llevaPrecio(naturaleza, actual)
              const importe = conPrecio ? importeLinea(actual) : null
              return (
                <tr key={campo.id} className="border-t align-top">
                  <td className="p-2 pt-4 tabular-nums text-muted-foreground">{n}</td>
                  <td className="p-2">
                    <Celda id={`${idBase}-l${i}-producto`} etiqueta={`Producto de la línea ${n}`} error={errorLinea?.productoId?.message}>
                      {(a) => <SelectorProducto {...a} valorActual={actual.productoId} {...register(`lineas.${i}.productoId`)} />}
                    </Celda>
                    {simular && (
                      <SimulacionLinea productoId={actual.productoId} cantidad={actual.cantidad} fecha={fecha} establecimientoId={establecimientoId} />
                    )}
                  </td>
                  <td className="p-2">
                    <Celda id={`${idBase}-l${i}-descripcion`} etiqueta={`Descripción de la línea ${n}`} error={errorLinea?.descripcion?.message}>
                      {(a) => <Input {...a} autoComplete="off" className="h-9" {...register(`lineas.${i}.descripcion`)} />}
                    </Celda>
                  </td>
                  {esAjuste && (
                    <td className="p-2">
                      <Celda id={`${idBase}-l${i}-movimiento`} etiqueta={`Movimiento de la línea ${n}`}>
                        {(a) => (
                          <CampoSelect {...a} opciones={[{ valor: 'ENTRADA', texto: 'Entrada' }, { valor: 'SALIDA', texto: 'Salida' }]}
                            {...register(`lineas.${i}.tipoMovimiento`)} />
                        )}
                      </Celda>
                    </td>
                  )}
                  {esAjuste && (
                    <td className="p-2">
                      {actual.tipoMovimiento === 'ENTRADA' ? (
                        <Controller
                          control={control}
                          name={`lineas.${i}.costoAlPromedio`}
                          render={({ field }) => (
                            <Celda id={`${idBase}-l${i}-valorizacion`} etiqueta={`Valorización de la entrada de la línea ${n}`}>
                              {(a) => (
                                <CampoSelect
                                  {...a}
                                  ref={field.ref}
                                  name={field.name}
                                  value={field.value ? 'PROMEDIO' : 'COSTO'}
                                  onBlur={field.onBlur}
                                  onChange={(evento) => field.onChange(evento.target.value === 'PROMEDIO')}
                                  opciones={[{ valor: 'PROMEDIO', texto: 'Al costo promedio' }, { valor: 'COSTO', texto: 'Con costo informado' }]}
                                />
                              )}
                            </Celda>
                          )}
                        />
                      ) : (
                        <p className="pt-2 text-xs text-muted-foreground">Sale al costo promedio</p>
                      )}
                    </td>
                  )}
                  <td className="p-2">
                    <Controller
                      control={control}
                      name={`lineas.${i}.cantidad`}
                      render={({ field }) => (
                        <Celda id={`${idBase}-l${i}-cantidad`} etiqueta={`Cantidad en TN de la línea ${n}`} error={errorLinea?.cantidad?.message}>
                          {(a) => (
                            <CampoDecimal {...a} ref={field.ref} name={field.name} decimales={4} valor={field.value}
                              alCambiar={field.onChange} onBlur={field.onBlur} className="h-9" />
                          )}
                        </Celda>
                      )}
                    />
                  </td>
                  {tituloPrecio && (
                    <td className="p-2">
                      {conPrecio ? (
                        <Controller
                          control={control}
                          name={`lineas.${i}.precio`}
                          render={({ field }) => (
                            <Celda id={`${idBase}-l${i}-precio`} etiqueta={`${tituloPrecio}, línea ${n}`} error={errorLinea?.precio?.message}>
                              {(a) => (
                                <CampoDecimal {...a} ref={field.ref} name={field.name} decimales={6} valor={field.value}
                                  alCambiar={field.onChange} onBlur={field.onBlur} className="h-9" />
                              )}
                            </Celda>
                          )}
                        />
                      ) : (
                        <p className="pt-2 text-right text-xs text-muted-foreground">Lo calcula la API</p>
                      )}
                    </td>
                  )}
                  {conImporte && (
                    <td className="p-2 pt-4 text-right tabular-nums">
                      {importe ? formatearImporte(importe, naturaleza === 'VENTA' ? moneda : 'PEN') : '—'}
                    </td>
                  )}
                  <td className="p-2">
                    {lineas.fields.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Quitar la línea ${n}`} onClick={() => alQuitar(i)}>
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {errorLineas && <p role="alert" className="text-sm text-destructive">{errorLineas}</p>}
      <div>
        <Button type="button" variant="outline" size="sm" aria-keyshortcuts="Alt+N" onClick={alAgregar}>
          <PlusIcon aria-hidden="true" />
          Agregar línea
          <Kbd aria-hidden="true" className="ml-1">Alt+N</Kbd>
        </Button>
      </div>
    </section>
  )
}
