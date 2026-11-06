import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Sin `globals` de Vitest, Testing Library no desmonta solo entre pruebas.
afterEach(() => cleanup())

// jsdom no trae lo que usan Radix (popover, checkbox) y cmdk (combobox): versiones mínimas solo para pruebas.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverFalso {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverFalso, configurable: true })
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function scrollIntoView() {}
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
