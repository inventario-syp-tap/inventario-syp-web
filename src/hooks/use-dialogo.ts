// Estado de un diálogo de alta/edición: si está abierto, con qué registro, cuántas veces se abrió (para usarlo
// como `key` y que el formulario nazca limpio en cada apertura, sin efectos de reinicio) y qué botón lo abrió
// (para devolverle el foco al cerrar, docs/UI-UX.md §7).
import { useCallback, useRef, useState } from 'react'

type Estado<T> = { abierto: boolean; datos: T | undefined; apertura: number }

export function useDialogo<T = undefined>() {
  const [estado, setEstado] = useState<Estado<T>>({ abierto: false, datos: undefined, apertura: 0 })
  const disparador = useRef<HTMLElement | null>(null)

  const abrir = useCallback((datos?: T, origen?: HTMLElement | null) => {
    disparador.current = origen ?? null
    setEstado((actual) => ({ abierto: true, datos, apertura: actual.apertura + 1 }))
  }, [])

  const cambiarAbierto = useCallback((abierto: boolean) => setEstado((actual) => ({ ...actual, abierto })), [])

  return { ...estado, abrir, cambiarAbierto, disparador }
}
