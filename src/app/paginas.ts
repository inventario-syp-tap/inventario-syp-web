// Rutas del módulo y menú lateral de docs/UI-UX.md §3: una sola definición para el router y el menú.
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine, ArrowUpFromLine, BookOpen, BookText, Boxes, Building2, CalendarCheck, ClipboardList, Coins,
  DatabaseBackup, FileSpreadsheet, FileStack, FileText, Gauge, History, House, Landmark, ListChecks, PackageMinus,
  Percent, Scale, ScrollText, Settings, ShieldCheck, SlidersHorizontal, Truck, Upload, Users, Weight,
} from 'lucide-react'
import { A_C, A_C_S, SOLO_A, TODOS, type Rol } from '@/lib/roles'

export const RAIZ_MODULO = '/inventario'

export type Pagina = {
  /** Ruta completa ("/inventario/kardex"). */
  ruta: string
  titulo: string
  /** Roles que pueden VER la página. */
  roles: readonly Rol[]
  icono: LucideIcon
  /** Sprint en que se implementa (para "En construcción"). */
  sprint: number
}

export type GrupoMenu = { titulo: string; paginas: Pagina[] }

const p = (ruta: string, titulo: string, roles: readonly Rol[], icono: LucideIcon, sprint: number): Pagina => ({
  ruta: ruta ? `${RAIZ_MODULO}/${ruta}` : RAIZ_MODULO,
  titulo,
  roles,
  icono,
  sprint,
})

export const INICIO = p('', 'Inicio', TODOS, House, 12)

export const GRUPOS_MENU: GrupoMenu[] = [
  { titulo: 'Inicio', paginas: [INICIO] },
  {
    titulo: 'Operaciones',
    paginas: [
      p('compras/nueva', 'Compra', A_C_S, ArrowDownToLine, 8),
      p('ventas/nueva', 'Venta', A_C_S, ArrowUpFromLine, 8),
      p('mermas/nueva', 'Merma', A_C, PackageMinus, 8),
      p('ajustes/nuevo', 'Ajuste', A_C, SlidersHorizontal, 8),
      p('comprobantes', 'Comprobantes', TODOS, FileStack, 8),
    ],
  },
  {
    titulo: 'Inventario',
    paginas: [
      p('kardex', 'Kardex', TODOS, Boxes, 9),
      p('periodos', 'Periodos', TODOS, CalendarCheck, 9),
      p('saldos-iniciales', 'Saldos iniciales', TODOS, Scale, 9),
    ],
  },
  {
    titulo: 'Libros y reportes',
    paginas: [
      p('libros/12-1', 'Libro 12.1', TODOS, BookOpen, 10),
      p('libros/13-1', 'Libro 13.1', TODOS, BookText, 10),
      p('reportes/toneladas', 'Toneladas', TODOS, Weight, 10),
      p('reportes/costo-ventas', 'Costo de ventas', TODOS, Coins, 10),
      p('reportes/resumen-anual', 'Resumen anual', TODOS, FileText, 10),
      p('reportes/margen', 'Margen', TODOS, Percent, 10),
      p('reportes/excel-contadora', 'Excel contadora', A_C, FileSpreadsheet, 10),
    ],
  },
  {
    titulo: 'Contabilidad y control',
    paginas: [
      p('asientos', 'Asientos', TODOS, Landmark, 11),
      p('control-tonelaje', 'Control de tonelaje', TODOS, Gauge, 11),
      p('toma-inventario', 'Toma de inventario', TODOS, ClipboardList, 11),
    ],
  },
  {
    titulo: 'Maestros',
    paginas: [
      p('maestros/productos', 'Productos', TODOS, Boxes, 7),
      p('maestros/terceros', 'Clientes y proveedores', TODOS, Truck, 7),
      p('maestros/reglas-contables', 'Reglas contables', TODOS, ScrollText, 7),
      p('maestros/establecimientos', 'Establecimientos', TODOS, Building2, 7),
    ],
  },
  {
    titulo: 'Administración',
    paginas: [
      p('configuracion', 'Configuración', A_C, Settings, 7),
      p('configuracion/usuarios', 'Usuarios', SOLO_A, Users, 7),
      p('configuracion/importacion', 'Importación', SOLO_A, Upload, 6),
      p('paridad', 'Paridad con Excel', A_C, ListChecks, 12),
      p('auditoria', 'Auditoría', SOLO_A, History, 12),
      p('respaldo', 'Respaldo', SOLO_A, DatabaseBackup, 12),
    ],
  },
]

/** Páginas que no están en el menú (se llega desde otra pantalla). */
export const PAGINAS_FUERA_DEL_MENU: Pagina[] = [
  p('comprobantes/:id', 'Detalle del comprobante', TODOS, FileStack, 8),
  p('periodos/cierre-anual', 'Cierre anual', A_C, ShieldCheck, 9),
  p('toma-inventario/nueva', 'Nueva toma de inventario', A_C, ClipboardList, 11),
  p('toma-inventario/:id', 'Detalle de la toma', TODOS, ClipboardList, 11),
]

/** Todas las páginas del módulo menos Inicio. */
export const PAGINAS_DEL_MODULO: Pagina[] = [
  ...GRUPOS_MENU.flatMap((grupo) => grupo.paginas).filter((pagina) => pagina !== INICIO),
  ...PAGINAS_FUERA_DEL_MENU,
]
