# UI/UX — Sistema de Inventario S&P (frontend)

> Documento de diseño del repositorio **público**. Todos los ejemplos usan **datos de demostración** (§10): nunca copiar aquí nombres, documentos, cantidades ni importes reales.
> Las secciones se citan en los prompts de los sprints: §2 tokens, §3 rutas y menú, §4 componentes, §5 pantallas, §7 accesibilidad.

## 1. Usuarios y principios

| Rol (en el token: `inventario:<ROL>`) | Quién | Uso |
|---|---|---|
| **CONTADOR** | la contadora (usuaria principal) | registra compras, ventas, mermas y ajustes; cierra meses; imprime el libro 12.1; exporta el asiento a WinConta. Trabaja en escritorio, con teclado, y conoce de memoria su Excel |
| **ADMIN** | administrador del sistema | usuarios, configuración, importación, respaldo, auditoría (y todo lo del contador) |
| **ASISTENTE** | apoyo futuro | registra compras y ventas; consulta |
| **CONSULTA** | gerencia, jurado de la demo | solo lectura |

Principios:
1. **Los números son los protagonistas**: alineados a la derecha, cifras tabulares, jerarquía clara. Nada decorativo compite con las tablas.
2. **Se parece a su Excel** (encabezados azul acero, filas de saldo resaltadas, mismos nombres de columnas) para que el cambio sea natural.
3. **El front muestra y captura; la API calcula y valida.** Las vistas previas de importes son solo orientativas (big.js); el valor oficial es el que devuelve la API.
4. **Nada se borra**: se anula con motivo. Todo lo que cambia el kardex muestra antes su efecto y pide confirmación cuando corresponde.
5. **Mensajes en el idioma de la contadora**: "El mes de marzo está cerrado", no "409 Conflict".
6. Estilo **industrial-contable**: sobrio, preciso, denso en datos, con buen contraste y sin animaciones innecesarias.

## 2. Tokens de diseño

Se definen en `src/estilos/globals.css` con variables CSS y `@theme inline` de Tailwind 4, usando los **nombres estándar de shadcn** (así los componentes funcionan sin cambios y el tema es intercambiable con otros módulos de la plataforma).

| Token (shadcn) | Claro | Oscuro | Uso |
|---|---|---|---|
| `--background` | `#F6F6F3` | `#0F1115` | fondo de la app |
| `--foreground` | `#1C1F24` | `#E7E9EE` | texto principal |
| `--card` / `--popover` | `#FFFFFF` | `#171A21` | tarjetas, tablas, diálogos, menús (sus `-foreground` = `--foreground`) |
| `--muted` | `#EEF1F5` | `#1E232C` | filas de SALDO INICIAL y subtotales, encabezados secundarios |
| `--muted-foreground` | `#5B616B` | `#A2A8B3` | etiquetas y ayudas |
| `--secondary` / `--accent` | `#EEF1F5` | `#1E232C` | botones secundarios, hover de menús |
| `--border` / `--input` | `#DEDFDA` | `#2A303B` | bordes, divisores, bordes de campos |
| `--primary` | `#1F4E79` | `#6AA5DB` | azul acero: botones principales, navegación activa, encabezados de tabla |
| `--primary-foreground` | `#FFFFFF` | `#0F1115` | texto sobre primario |
| `--ring` | `#1F4E79` | `#6AA5DB` | anillo de foco |
| `--destructive` | `#B91C1C` | `#F87171` | stock negativo, errores, anular |
| `--success` *(extra)* | `#15803D` | `#4ADE80` | periodo cerrado, paridad OK, exportado |
| `--warning` *(extra)* | `#B45309` | `#FBBF24` | fecha fuera de orden, SI desactualizado, impresión pendiente |
| `--chart-1` / `--chart-2` / `--chart-3` | `#52525B` / `#0E7490` / `#B4602A` | `#A1A1AA` / `#22D3EE` / `#F0A06A` | color de cada producto (puntos, chips, gráficos), por su orden en el maestro |
| `--sidebar*` | como `--card`, `--foreground`, `--primary`… | ídem | barra lateral (componente Sidebar) |

- Los extra se registran como `--color-success` y `--color-warning` (con `-foreground`) para usar `bg-success`, `text-warning`, etc.
- Los colores de producto nunca se usan como color de texto largo. Contraste ≥ 4.5:1 en texto y ≥ 3:1 en elementos gráficos (verificar ambos temas).
- **Radios**: `--radius: 0.625rem`. Sombras mínimas; preferir bordes.
- **Tipografía**: pila del sistema (`ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`; en Windows se ve Segoe UI). Sin fuentes externas ni Google Fonts (CSP). Toda celda numérica con `tabular-nums`; documentos (RUC, serie-número, cuentas) con `font-mono`.
- **Escala**: 12 (ayudas) · 13 (tablas) · 14 (formularios y cuerpo) · 16 (títulos de sección) · 20 (título de página) · 28 (cifras del dashboard).
- **Densidad**: filas de tabla de 32 px, inputs de 36 px, espaciado base 4 px.
- Tema claro por defecto; oscuro opcional desde el menú de usuario (preferencia en `localStorage`, solo el tema).

## 3. Estructura, rutas y menú

```
┌──────────────────┬───────────────────────────────────────────────────────────────────────┐
│ ▣ Inventario S&P │ Inicio › Kardex          [ 2026 ▾ ] [ Marzo ▾ ]  ● Abierto     👤 Usuario ▾ │
│                  ├───────────────────────────────────────────────────────────────────────┤
│ ▸ Inicio         │                                                                       │
│ OPERACIONES      │   Título de la página                         [Acción secundaria] [Acción] │
│   Compra         │                                                                       │
│   Venta          │   Contenido                                                           │
│   Merma          │                                                                       │
│   Ajuste         │                                                                       │
│   Comprobantes   │                                                                       │
│ INVENTARIO       │                                                                       │
│   Kardex         │                                                                       │
│   Periodos       │                                                                       │
│ LIBROS Y REPORTES│                                                                       │
│ CONTABILIDAD     │                                                                       │
│ MAESTROS         │                                                                       │
│ ADMINISTRACIÓN   │                                                                       │
└──────────────────┴───────────────────────────────────────────────────────────────────────┘
```

- Router de React Router 8 en **modo datos** (`createBrowserRouter` + `RouterProvider` de `react-router/dom`). Todas las pantallas del módulo cuelgan de **`/inventario`** (el día que exista una plataforma con varios módulos, ninguna URL cambia).
- Barra superior: migas de pan, **periodo de trabajo** (año y mes; se recuerda en `sessionStorage` solo como preferencia de pantalla), chip del estado del periodo (Abierto / Cerrado), menú de usuario (Cambiar contraseña, Tema claro/oscuro, Salir).
- **Etiqueta de demostración** (S13): si `GET /salud` responde `demo: true` (API levantada con `pnpm run start:demo`), la barra superior muestra el distintivo "DEMOSTRACIÓN · datos ficticios" (ícono + texto, color `warning`), visible también en las capturas. En ese modo las pantallas Importación y Paridad muestran un aviso en lugar de la tabla.

| Ruta | Pantalla (§5) | Ver | Acciones | Sprint |
|---|---|---|---|---|
| `/login` | Iniciar sesión | público | — | S5 |
| `/cambiar-password` | Cambiar contraseña | autenticado | — | S5 |
| `/` | → `/inventario` | — | — | S5 |
| `/inventario` | Dashboard (S5: inicio vacío) | todos | — | S12 |
| `/inventario/compras/nueva` | Registrar compra | A, C, S | A, C, S | S8 |
| `/inventario/ventas/nueva` | Registrar venta o exportación | A, C, S | A, C, S | S8 |
| `/inventario/mermas/nueva` | Registrar merma o desmedro | A, C | A, C | S8 |
| `/inventario/ajustes/nuevo` | Registrar ajuste | A, C | A, C | S8 |
| `/inventario/comprobantes` · `/:id` | Comprobantes y detalle | todos | editar A, C (S: sus compras y ventas); anular A, C | S8 |
| `/inventario/kardex` | Kardex | todos | reordenar A, C; recalcular A | S9 |
| `/inventario/periodos` | Periodos | todos | cerrar/reabrir A, C | S9 |
| `/inventario/periodos/cierre-anual` | Cierre anual | A, C | A, C | S9 |
| `/inventario/saldos-iniciales` | Saldos iniciales | todos | SI manual A, C | S9 |
| `/inventario/libros/12-1` | Libro 12.1 (unidades físicas) | todos | registrar impresión A, C | S10 |
| `/inventario/libros/13-1` | Libro 13.1 (valorizado) | todos | — | S10 |
| `/inventario/reportes/:reporte` | Toneladas · Costo de ventas · Resumen anual · Margen | todos | — | S10 |
| `/inventario/reportes/excel-contadora` | Excel formato contadora | A, C | A, C | S10 |
| `/inventario/asientos` | Asientos y WinConta | todos | exportar A, C | S11 |
| `/inventario/control-tonelaje` | Control de tonelaje | todos | editar A, C | S11 |
| `/inventario/toma-inventario` | Toma de inventario | todos | crear/resolver A, C | S11 |
| `/inventario/maestros/productos` | Productos | todos | A, C | S7 |
| `/inventario/maestros/terceros` | Clientes y proveedores | todos | A, C, S | S7 |
| `/inventario/maestros/reglas-contables` | Reglas contables | todos | A, C | S7 |
| `/inventario/maestros/establecimientos` | Establecimientos | todos | A | S7 |
| `/inventario/configuracion` | Configuración | A, C | A (C: pestañas Libro 12.1 y WinConta) | S7 |
| `/inventario/configuracion/usuarios` | Usuarios | A | A | S7 |
| `/inventario/configuracion/importacion` | Importación y paridad | A | A | S6 |
| `/inventario/paridad` | Paridad con Excel | A, C | — | S12 |
| `/inventario/auditoria` | Auditoría | A | — | S12 |
| `/inventario/respaldo` | Respaldo | A | A | S12 |
| `*` | Página no encontrada | — | — | S5 |

A = ADMIN · C = CONTADOR · S = ASISTENTE · todos = incluye CONSULTA. Una ruta sin permiso redirige a `/inventario` con el aviso "No tienes permiso para ver esa página". Los botones de acción sin permiso **no se muestran** (y la API igual lo impide).

Menú lateral (240 px, plegable a íconos):

| Grupo | Ítems | Visible para |
|---|---|---|
| Inicio | Dashboard | todos |
| Operaciones | Compra · Venta · Merma · Ajuste · Comprobantes | según la tabla (Comprobantes: todos) |
| Inventario | Kardex · Periodos · Saldos iniciales | todos (Cierre anual dentro de Periodos: A, C) |
| Libros y reportes | Libro 12.1 · Libro 13.1 · Toneladas · Costo de ventas · Resumen anual · Margen · Excel contadora | todos (Excel contadora: A, C) |
| Contabilidad y control | Asientos · Control de tonelaje · Toma de inventario | todos |
| Maestros | Productos · Clientes y proveedores · Reglas contables · Establecimientos | todos |
| Administración | Configuración · Usuarios · Importación · Paridad con Excel · Auditoría · Respaldo | A (Configuración y Paridad: A, C) |

## 4. Componentes

**shadcn 4 (Radix)** — se agregan con `pnpm dlx shadcn@4 add …` en `src/componentes/ui/` (se ajustan solo estilos): button, input, label, field, select, checkbox, radio-group, switch, textarea, dialog, alert-dialog, sheet, dropdown-menu, popover, command, tooltip, tabs, card, badge, table, skeleton, separator, scroll-area, sidebar, breadcrumb, pagination, sonner, spinner, empty, kbd. Si alguno no existe en la versión instalada, se usa el equivalente más cercano y se anota en `docs/AVANCE.md`.

**Comunes** (`src/componentes/comunes/`, con pruebas):

| Componente | Qué hace |
|---|---|
| `TablaDatos` | TanStack Table 8: búsqueda (`/` enfoca), orden (`aria-sort`), paginación del servidor, columnas numéricas a la derecha con `tabular-nums`, cabecera fija, estado vacío y de carga |
| `Cifra` | muestra un decimal (string) con `lib/formato.ts`; negativos en `text-destructive` con signo menos e ícono ⛔ + texto oculto "negativo" |
| `CampoDecimal` | input de texto con `inputMode="decimal"`: acepta coma o punto, limita decimales (4 TN, 6 precios, 3 tipo de cambio), alineado a la derecha, sin flechas; entrega **string** |
| `CampoFecha` | `<input type="date">` nativo (valor `YYYY-MM-DD`), sin dependencias extra; muestra el mes cerrado como error |
| `SelectorTercero` | combobox (command) que busca por documento o razón social (`GET /terceros?q=`), muestra tipo y número en `font-mono`, botón "+ Nuevo" con validación de RUC en vivo |
| `SelectorProducto` | chips o select con el punto de color del producto |
| `SelectorPeriodo` | año + mes ("Todo el año" opcional) |
| `ChipEstadoPeriodo` | Abierto (borde) / Cerrado (✓ `success`) con texto |
| `IconoAlerta` | STOCK_NEGATIVO ⛔, FECHA_FUERA_DE_ORDEN ↕, SALDO_CERO_CON_COSTO ⚠, SI desactualizado ⚠: ícono + tooltip + texto para lectores de pantalla |
| `DialogoConfirmacion` | alert-dialog que repite el efecto ("Se anulará F001-0000123 y se recalculará el kardex de FIERRO 2026") con motivo opcional u obligatorio |
| `DialogoStockNegativo` | ante 409 `STOCK_NEGATIVO_REQUIERE_CONFIRMACION`: producto, fecha, disponible antes, saldo resultante; "Registrar de todos modos" reenvía con `confirmarStockNegativo: true` |
| `BannerServidor` | "Conectando con el servidor… (puede tardar hasta 1 minuto)" con barra indeterminada mientras el cliente reintenta |
| `BotonDescarga` | descarga PDF/Excel como blob con el nombre de `Content-Disposition`, muestra progreso y error |
| `EstadoVacio` / `EstadoError` | mensaje + acción ("Registrar compra", "Reintentar") |
| `RutaProtegida` | exige sesión y rol (`tieneRol('inventario', …)`), si no redirige |

## 5. Pantallas

### 5.1 Iniciar sesión y cambiar contraseña (S5)
- Login centrado: "Sistema de Inventario S&P", correo, contraseña (botón "Mostrar"), botón **Ingresar**. Un solo mensaje para `CREDENCIALES_INVALIDAS` (la API no distingue contraseña incorrecta de cuenta bloqueada, para no revelar qué correos existen): "Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos." Con 429: "Demasiados intentos. Espera un minuto". Si la API dormía: `BannerServidor`. Un 401 del login nunca dispara el refresh automático.
- Si `debeCambiarPassword`: va a **Cambiar contraseña** (actual, nueva, repetir; mínimo 12 caracteres con indicador) y no deja navegar hasta cambiarla.

### 5.2 Dashboard (S12)
```
Año [2026 ▾]
┌ ● FIERRO ───────────┐ ┌ ● INOXIDABLE ───────┐ ┌ ● COBRE ────────────┐
│ Stock    120.5000 TN│ │ Stock     45.2500 TN│ │ Stock     12.0000 TN│
│ Valor  S/ 7,230.00  │ │ Valor S/ 72,400.00  │ │ Valor S/ 30,000.00  │
│ CU     S/ 60.00 /TN │ │ CU   S/ 1,600.00    │ │ CU   S/ 2,500.00    │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
Compras del mes 100.0000 TN · S/ 6,000.00     Ventas del mes 90.0000 TN · costo S/ 5,400.00
┌ Alertas ─────────────────────────────────────┐ ┌ Toneladas por mes (compras vs ventas) ─┐
│ ⚠ Libro 12.1 de febrero sin imprimir  [Ir]   │ │  (recharts, barras agrupadas)          │
│ ⚠ Asiento de febrero sin exportar     [Ir]   │ │                                        │
│ ⛔ Stock negativo: ninguno                    │ │                                        │
│ ⚠ Sin toma de inventario este año (nov.)     │ │                                        │
└──────────────────────────────────────────────┘ └────────────────────────────────────────┘
```
(Valores ilustrativos.) Cada alerta con acceso directo a la pantalla que la resuelve.

### 5.3 Registrar compra (S8)
```
Registrar compra                                               [Guardar y nueva] [Guardar  Ctrl+↵]
Proveedor [🔍 RUC o razón social ............ ▾] (+ Nuevo)    Comprobante [01 Factura ▾]
Serie [F001]  Número [123]   Fecha de emisión [15/03/2026]   ▸ Referencias (guía, ticket de balanza, placa)
┌───┬───────────────┬──────────────────────────────┬─────────────┬────────────────┬──────────────┬───┐
│ # │ Producto      │ Descripción / calidad        │ Cantidad TN │ Costo S/ x TN  │ Importe S/   │   │
├───┼───────────────┼──────────────────────────────┼─────────────┼────────────────┼──────────────┼───┤
│ 1 │ ● FIERRO ▾    │ Chatarra pesada              │     10.0000 │     100.000000 │     1,000.00 │ 🗑 │
│ 2 │ ● INOX ▾      │ Chatarra inox B              │      2.5000 │   1,000.000000 │     2,500.00 │ 🗑 │
└───┴───────────────┴──────────────────────────────┴─────────────┴────────────────┴──────────────┴───┘
[+ Agregar línea  Alt+N]                                         Total 12.5000 TN · S/ 3,500.00 (vista previa)
```
- Costo unitario **sin IGV** (hasta 6 decimales). Descripción con sugerencias de las usadas antes para ese producto.
- Al guardar: toast "Compra F001-0000123 registrada · kardex recalculado" con enlace "Ver kardex". Mes cerrado: aviso y Guardar deshabilitado. Duplicado: "Ya existe la factura F001-0000123 de este proveedor".

### 5.4 Registrar venta o exportación (S8)
Como la compra, con **Cliente**, tipo de comprobante (01 factura / 03 boleta, con "CLIENTES VARIOS" para boletas sin identificar), **operación** (`01 Venta nacional` / `17 Exportación`; con **03 Boleta** la operación queda en 01 y 17 se deshabilita con la ayuda "La exportación requiere factura"), **moneda** (PEN / USD; con USD el **tipo de cambio** es obligatorio) y **valor de venta unitario sin IGV** (obligatorio). Cada línea muestra a la derecha "Disponible al 15/03: 25.0000 TN · costo estimado S/ 1,500.00" (`POST /comprobantes/simular-salida`, 400 ms después de escribir). Si queda negativo se avisa en la línea; al guardar, la API decide (política de stock) y, si pide confirmación, aparece `DialogoStockNegativo`.

### 5.5 Registrar merma o desmedro (S8)
Selector `13 Merma` / `14 Desmedro`, fecha, líneas por producto con cantidad y **sustento** obligatorio:
- **Merma (13)**: **año del informe técnico** (el documento queda `00-IT-<año>`); sustento: informe técnico (profesional, colegiatura, fecha). Un mismo informe puede usarse en varias fechas del año.
- **Desmedro (14)**: el documento lo asigna la API (`00-AD-0001`, correlativo del año); sustento: acta de destrucción ante notario o juez de paz y comunicación previa a SUNAT.
- Ayuda: "Se valoriza al costo promedio vigente y va en un asiento aparte del costo de ventas".

### 5.6 Registrar ajuste (S8)
Operación `28`, documento interno `00-AI-0001` (correlativo del año, lo asigna la API), sustento (acta de toma de inventario) obligatorio. Por línea: **entrada** (al costo promedio o con costo informado) o **salida** (al promedio).

### 5.7 Comprobantes (S8)
Filtros en una fila: fechas, naturaleza, tercero, producto, estado y búsqueda por serie-número. Tabla: Fecha · Tipo · Serie-Número · Tercero · Productos (chips) · TN · Moneda · Estado. Acciones: **Ver** (panel lateral con las líneas y su efecto en el kardex), **Editar** (mes abierto), **Anular** (motivo obligatorio). Anulados tachados y en gris con el motivo en tooltip.

### 5.8 Kardex (S9) — la pantalla más importante
```
Producto ( ● FIERRO | ● INOX | ● COBRE )  Año [2026 ▾]  Mes [Marzo ▾ | Todo el año]  ☐ Detallado  [PDF 13.1] [Excel]
┌──────────┬───────────────┬────┬────────────────────┬───────── ENTRADAS ─────────┬────────── SALIDAS ──────────┬─────────── SALDO ───────────┬──┐
│ Fecha    │ Comprobante   │ Op │ Tercero / descr.   │ Cant.     C.U.     Total   │ Cant.     C.U.     Total    │ Cant.      C.U.     Total   │  │
├──────────┴───────────────┴────┴────────────────────┼────────────────────────────┼─────────────────────────────┼─────────────────────────────┼──┤
│ SALDO INICIAL                                      │                            │                             │  50.0000   60.00   3,000.00 │  │
│ 05/03/26  01 E001-0000045  01  CLIENTE DEMO S.A.C. │                            │ 10.0000   60.00    600.00   │  40.0000   60.00   2,400.00 │  │
│ 20/03/26  01 E001-0000052  01  CLIENTE DEMO S.A.C. │                            │ 45.0000   60.00  2,700.00   │  -5.0000   60.00    -300.00 │⛔│
│ 22/03/26  01 F001-0000130  02  PROVEEDOR DEMO SAC  │ 30.0000  50.00  1,500.00   │                             │  25.0000   48.00   1,200.00 │↕ │
├────────────────────────────────────────────────────┴────────────────────────────┴─────────────────────────────┴─────────────────────────────┴──┤
│ MARZO   Compras 30.0000 TN · S/ 1,500.00 │ Ventas 55.0000 TN · S/ 3,300.00 │ Saldo final 25.0000 TN · S/ 1,200.00                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- Encabezados agrupados `bg-primary text-primary-foreground` (como el Excel); SALDO INICIAL y subtotales `bg-muted` en negrita.
- Cantidades 4 decimales; CU y costos 2 (el detalle del panel lateral muestra CU con 4). Negativos con signo y ⛔ "Stock negativo". ↕ "Fecha anterior al movimiento previo (se respeta el orden de registro)".
- Clic en una fila → panel lateral con el comprobante. **Reordenar** (A, C): botones ↑/↓ solo dentro de la misma fecha, con confirmación que explica el efecto en el costo.
- Cabecera y primeras columnas fijas al desplazarse. "Detallado" agrega documento y descripción completa.
- (Valores ilustrativos.)

### 5.9 Periodos (S9)
Doce tarjetas por año: mes, estado, movimientos, compras y ventas (TN), libro 12.1 (impreso / pendiente / desactualizado) y asiento (exportado / pendiente / desactualizado). **Cerrar mes** (solo si el anterior está cerrado): diálogo con advertencias (saldos negativos listados, no bloquean). Si hay movimientos con saldo cero y costo, la API rechaza el cierre (`CIERRE_CON_SALDO_CERO_CON_COSTO`) y la pantalla lista esos movimientos con enlace al kardex. **Reabrir** (solo el último cerrado): motivo obligatorio. ADMIN: **Cerrar en bloque** (desde–hasta).

### 5.10 Cierre anual y saldos iniciales (S9)
Asistente de 3 pasos: (1) verificación de los 12 meses cerrados; (2) saldo inicial propuesto del año siguiente vs el existente, diferencias resaltadas con signo (p. ej. `+0.01`); (3) confirmación explícita ("Reemplazar el saldo inicial existente"). **Saldos iniciales**: tabla por año y producto con origen (Importación, Cierre anual, Manual) y la marca ⚠ "desactualizado"; editar un SI MANUAL exige motivo.

### 5.11 Libro 12.1 — unidades físicas (S10)
```
Libro 12.1   Año [2026 ▾]  Mes [Enero ▾ | Año completo]  Producto [Todos ▾]   Modo del año: AGRUPADO (Configuración)
[Vista previa]  [Descargar PDF]  [Página de prueba de márgenes]  [Registrar impresión]   Estado: ⚠ Pendiente de impresión
┌──────────────────────────────── vista previa igual a la hoja A4 horizontal ───────────────────────────────┐
│            REGISTRO DEL INVENTARIO PERMANENTE EN UNIDADES FÍSICAS                     ┌──────────────┐    │
│            DETALLE DEL INVENTARIO PERMANENTE EN UNIDADES FÍSICAS                      │ zona del     │    │
│ PERÍODO: ENERO--2026 · RUC · RAZÓN SOCIAL · ESTABLECIMIENTO · CÓDIGO · TIPO · UNIDAD  │ sello 70×30  │    │
│ FECHA | TIPO | SERIE | NÚMERO | OPERACIÓN | ENTRADAS | SALIDAS | SALDO FINAL           └──────────────┘    │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- Sin folio ni número de página (hojas legalizadas ya numeradas). Un bloque por mes y producto. Entradas/salidas con 3 decimales, saldos y totales con 2.
- **Registrar impresión**: fecha y observación; el estado pasa a ✓ Impreso. Si los datos del mes cambian después: ⚠ "Impresión desactualizada: vuelve a imprimir".
- **Página de prueba de márgenes**: para imprimir en papel común y compararla con una hoja legalizada.

### 5.12 Libro 13.1 y reportes (S10)
- **13.1 valorizado**: filtros como el kardex; descarga PDF y Excel; opción detallado.
- **Toneladas**, **Costo de ventas**, **Resumen anual**: tablas por mes como las hojas del Excel (con su total nombrado: "COSTO DE VENTAS", "MERMAS", "TOTAL SALIDAS VALORIZADAS"), descarga Excel.
- **Margen**: por producto y mes, ventas S/ − costo de ventas = margen y %; ventas sin precio aparte. Gráfico de barras simple.
- **Excel formato contadora** (A, C): descarga un .xlsx por año con sus hojas de siempre.

### 5.13 Asientos y WinConta (S11)
```
Asientos   Año [2026 ▾]  Mes [Enero ▾]   [Costo de ventas] [Mermas] [Desmedros] [Ajustes]   [Exportar a WinConta]
PROVISION COSTO DE VENTAS ENERO 2026
┌──────────────┬──────────────────────────────────┬──────────────┬──────────────┐
│ Cuenta       │ Detalle                          │ Debe S/      │ Haber S/     │
│ 691101       │ Costo de ventas — FIERRO         │     5,400.00 │              │
│ 201101       │ Mercaderías — FIERRO             │              │     5,400.00 │
├──────────────┴──────────────────────────────────┼──────────────┼──────────────┤
│ Totales                                         │     5,400.00 │     5,400.00 │ ✓ cuadra
└─────────────────────────────────────────────────┴──────────────┴──────────────┘
⚠ Salidas sin regla contable: ninguna      Historial: 0001 · 31/01/2026 · T.C. 3.700 · ✓ vigente
```
(Cuentas, importes y tipo de cambio ilustrativos.) El importe exacto aparece en tooltip. Una pestaña por tipo de asiento (Ajustes reúne faltantes y sobrantes). Si un tipo tiene movimientos sin regla vigente (p. ej. desmedros o ajustes mientras no se definan sus cuentas), **Exportar** se deshabilita solo para ese tipo, con el enlace "Configurar reglas contables". **Exportar** abre un diálogo: N.° de asiento (4 dígitos), tipo de cambio (3 decimales) → descarga el `.xlsx` de 19 columnas y lo registra en el historial (⚠ "desactualizado" si el mes cambió después).

### 5.14 Control de tonelaje (S11)
Tabla por mes: Mes · Toneladas reportadas (editable, A y C) · Fuente · Compras del kardex (TN) · Diferencia (≠ 0: fondo `warning` suave + ícono + texto "Diferencia") · Observación. Descarga Excel.

### 5.15 Toma de inventario (S11)
Lista de tomas (fecha, responsable, estado). **Nueva toma** — asistente: (1) fecha y responsable; (2) cantidad contada (pesada) por producto; (3) diferencias: saldo del sistema a esa fecha, contado, diferencia; (4) acción por producto: **Merma (13)** con sustento, **Ajuste (28)** o **Ninguna** con observación → "Resolver" genera los comprobantes enlazados. Recordatorio anual en el dashboard desde noviembre (no obligatorio).

### 5.16 Maestros (S7)
Tablas con búsqueda y diálogo de edición:
- **Productos**: código, código del libro, descripción, Tabla 5, unidad (Tabla 6, TNE), método (Tabla 14), cuentas contables, activo.
- **Clientes y proveedores**: tipo de documento (Tabla 2), número (validación en vivo: RUC con dígito verificador, DNI 8 dígitos; tipo 0 sin número), razón social (mayúsculas), rol (proveedor / cliente), país.
- **Reglas contables**: tipo de asiento (Costo de ventas, Merma, Desmedro, Ajuste faltante, Ajuste sobrante), producto, operación, cuenta Debe, cuenta Haber, vigente desde / hasta (AAAA-MM). No se borran: se cierran con "vigente hasta". Si la vigencia se cruza con otra regla del mismo tipo, producto y operación, la API responde `VIGENCIA_SUPERPUESTA` y el diálogo lo muestra junto a las fechas.
- **Establecimientos**: código y texto para el libro (`0001-LOCAL COMERCIAL`); todos ven la lista, solo ADMIN crea y edita.

### 5.17 Configuración (S7)
Pestañas: **Empresa** (A: datos, política de stock negativo `Permitir con alerta` / `Bloquear`), **Libro 12.1** (A, C: modo por año, decimales, márgenes, reserva del sello, recordatorio de impresión), **WinConta** (A, C: subdiario, Tip.CP, Cod.CP, razón social, T.D., plantillas de número y glosa), **Toma de inventario** (A: recordatorio).

### 5.18 Usuarios (S7, ADMIN)
Tabla: nombre, correo, roles (chips), activo, último acceso. **Nuevo usuario** (correo, nombre, roles) → muestra **una sola vez** la contraseña temporal con botón Copiar y el aviso "No se volverá a mostrar". Desactivar (cierra sus sesiones) y Restablecer contraseña con confirmación.

### 5.19 Importación y paridad (S6, ADMIN)
```
Importación de datos históricos                         [Cargar histórico 2024–2026]  [Verificar paridad]
Última carga: 15/10/2026 10:32 · lote ✓ (repetir no duplica)
┌ Kardex ─────────────┬───────┬─────────────┬──────────────┬────────┐
│ Año · Producto      │ Filas │ Diferencias │ Dif. máxima  │ Estado │
│ 2024 · FIERRO       │   ### │           0 │ 0.000000     │   ✓    │
│ …                   │       │             │              │        │
└─────────────────────┴───────┴─────────────┴──────────────┴────────┘
Resumen mensual ✓ · Asientos ✓ · Libro 12.1: diferencias conocidas explicadas ✓
```
"Cargar histórico" pide confirmación y muestra cuántos terceros, comprobantes y movimientos se cargaron.

### 5.20 Paridad con Excel (S12, ADMIN y CONTADOR)
Pensada para la contadora y para la sustentación: por año y producto, los 12 meses con SI, compras, ventas, mermas y SF **Excel vs sistema** (✓ por celda), los asientos y las diferencias conocidas del libro 12.1 con su **motivo y decisión** (p. ej. "Unidad TN → TNE (D-04)").

### 5.21 Auditoría (S12, ADMIN)
Pestañas **Cambios** (usuario, entidad, acción, fechas; detalle con antes/después resaltado) y **Accesos** (login, fallidos, bloqueos, refresh reutilizado). Solo lectura.

### 5.22 Respaldo (S12, ADMIN)
Dos tarjetas: **Descargar respaldo completo** (`.dump`, para restaurar con `pg_restore`) y **Exportar datos a Excel**. Aviso: "Guárdalos fuera de GitHub (Drive u OneDrive de la empresa)". Confirmación antes de descargar; límite de 3 por minuto.

## 6. Estados, mensajes y teclado

- **Cargando**: esqueletos con la forma de la tabla; nunca pantallas en blanco.
- **Vacío**: mensaje + acción ("Aún no hay compras en marzo. [Registrar compra]").
- **Error**: mensaje en español según el `codigo` de la API + "Reintentar". Validación junto al campo (`aria-describedby`).
- **Despertando el servidor** (plan gratuito): `BannerServidor` mientras el cliente reintenta (502/503/504 o tiempo agotado, esperas crecientes hasta ~90 s).
- **Éxito**: toast breve (sonner). Errores: persisten hasta cerrarlos.

| `codigo` de la API | Mensaje para el usuario |
|---|---|
| `VALIDACION` | Revisa los campos marcados. |
| `NO_AUTENTICADO` | Tu sesión terminó. Vuelve a ingresar. |
| `SIN_PERMISO` | No tienes permiso para esta acción. (ASISTENTE que edita un comprobante: "Solo puedes editar las compras y ventas que registraste tú.") |
| `NO_ENCONTRADO` | No encontramos ese registro (quizá fue anulado). |
| `PERIODO_CERRADO` | El mes de {mes} está cerrado: no se puede registrar ni modificar. Pide reabrirlo si necesitas cambiarlo. ({mes} según la fecha del comprobante: "marzo de 2026") |
| `PERIODO_ANTERIOR_ABIERTO` | Primero cierra el mes anterior. |
| `PERIODO_POSTERIOR_CERRADO` | Solo se puede reabrir el último mes cerrado. |
| `STOCK_NEGATIVO_REQUIERE_CONFIRMACION` | (diálogo) Esta salida deja {producto} en {saldo} TN al {fecha}. ¿Registrar de todos modos? |
| `STOCK_INSUFICIENTE` | No hay stock suficiente de {producto} al {fecha} (disponible {disponible} TN). (Política BLOQUEAR: sin opción de confirmar) |
| `ORDEN_EN_CONFLICTO` | Otro usuario modificó este kardex al mismo tiempo; vuelve a intentarlo. (Con botón **Reintentar**, que reenvía lo mismo) |
| `COMPROBANTE_DUPLICADO` | Ya existe {tipo} {serie}-{número} de este tercero. (Junto al Número: "Ya existe la factura F001-0000123 de este proveedor.") |
| `RUC_INVALIDO` / `DOCUMENTO_INVALIDO` | El RUC no es válido (revisa los 11 dígitos) / El documento no tiene el formato correcto. |
| `SUSTENTO_REQUERIDO` | Indica el sustento (informe técnico o acta). |
| `PRECIO_VENTA_REQUERIDO` | Indica el valor de venta sin IGV de cada línea. |
| `TIPO_CAMBIO_REQUERIDO` | Para ventas en dólares indica el tipo de cambio de la fecha de emisión. |
| `SALDO_INICIAL_INEXISTENTE` | Falta el saldo inicial de {año}: haz el cierre anual de {año−1}. |
| `CIERRE_ANUAL_INCOMPLETO` | Cierra los 12 meses antes del cierre anual. |
| `CIERRE_CON_SALDO_CERO_CON_COSTO` | No se puede cerrar {mes}: hay movimientos con saldo cero y costo. Revísalos en el kardex (lista abajo). |
| `VIGENCIA_SUPERPUESTA` | Ya existe una regla vigente en esas fechas para el mismo tipo, producto y operación. Cierra la anterior con "vigente hasta". |
| `VIGENCIA_INVALIDA` | La vigencia no es válida: usa AAAA-MM y que "vigente hasta" no sea anterior a "vigente desde". |
| `OPERACION_NO_CORRESPONDE` | La operación no corresponde al tipo de asiento (costo de ventas: 01 o 17 · merma: 13 · desmedro: 14 · ajustes: 28). |
| `PRODUCTO_INEXISTENTE` | Ese producto no existe o está inactivo. |
| `TERCERO_INEXISTENTE` | Ese cliente o proveedor no existe o está inactivo. |
| `ESTABLECIMIENTO_INEXISTENTE` | Ese establecimiento no existe o está inactivo. |
| `CODIGO_SUNAT_INVALIDO` | Uno de los códigos SUNAT (Tabla 5, 6 o 14) no es válido. |
| `CUENTA_INVALIDA` | La cuenta contable debe tener de 2 a 12 dígitos. |
| `TERCERO_DUPLICADO` | Ya existe un cliente o proveedor con ese documento. |
| `TERCERO_PROTEGIDO` | "CLIENTES VARIOS" no puede cambiar de documento ni de nombre. |
| `PRODUCTO_DUPLICADO` | Ya existe un producto con ese código. |
| `ESTABLECIMIENTO_DUPLICADO` | Ya existe un establecimiento con ese código. |
| `SALDO_INICIAL_REQUIERE_CONFIRMACION` | (paso 3 del asistente) El saldo inicial de {año+1} ya existe y es distinto. ¿Reemplazarlo? |
| `COMPROBANTE_ANULADO` | Ese comprobante está anulado: ya no se puede editar ni mover. |
| `REORDEN_FUERA_DE_FECHA` | Solo se puede mover dentro de la misma fecha. |
| `HISTORICO_YA_CARGADO` | El histórico 2024–2026 ya está cargado en esta base. |
| `NO_DISPONIBLE_EN_DEMO` | No disponible en la base de demostración. |
| `REGLA_CONTABLE_FALTANTE` | Hay movimientos sin regla contable: configúrala en Maestros → Reglas contables. |
| `CREDENCIALES_INVALIDAS` | Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos. |
| `DEMASIADAS_SOLICITUDES` | Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo. |
| `ERROR_INTERNO` | Ocurrió un error inesperado. Intenta de nuevo; si continúa, avisa al administrador (código {requestId}). |

**Teclado**: `Alt+N` nueva línea · `Ctrl+Enter` guardar · `Esc` cerrar diálogo · `/` buscar en la tabla · flechas en listas. Orden de tabulación lógico en formularios de varias líneas; el foco vuelve al disparador al cerrar un diálogo.

## 7. Accesibilidad (WCAG 2.2 AA)

- Contraste verificado en ambos temas; foco visible (anillo `--ring` de 2 px) en todo elemento interactivo.
- `<label>` en todos los campos; errores asociados con `aria-describedby` y `aria-invalid`.
- Tablas con `<caption>` (puede ser solo para lectores), `scope` en encabezados y `aria-sort` en columnas ordenables.
- Nada se comunica solo con color: alertas con ícono **y** texto (visible o `sr-only`).
- Todo se puede hacer con teclado (menú, tablas, diálogos, combobox); los diálogos atrapan el foco (Radix).
- Objetivos táctiles ≥ 24 × 24 px; textos ampliables al 200 % sin perder contenido.
- `lang="es"` en el documento; títulos de página únicos ("Kardex · Inventario S&P").
- Mensajes de estado (toasts, banner del servidor) con `role="status"` o `aria-live="polite"`.

## 8. Responsive e impresión

- ≥ 1280 px: diseño completo. 768–1279 px: menú plegado; tablas con desplazamiento horizontal y columnas fijas. < 768 px: consulta (dashboard, kardex, reportes); registrar es posible, pero se recomienda escritorio.
- La impresión oficial del 12.1 es el **PDF de la API**; la vista previa en pantalla no se imprime con el navegador.

## 9. Formatos (es-PE) — `src/lib/formato.ts`

| Función | Ejemplo |
|---|---|
| `formatearToneladas("1234.5")` | `1,234.5000` |
| `formatearSoles("1234.5")` | `S/ 1,234.50` |
| `formatearCU("60.123456")` | `60.12` (detalle: 4 decimales) |
| `formatearFecha("2026-03-15")` | `15/03/2026` (sin `new Date('YYYY-MM-DD')`: se parte el texto) |
| `formatearPeriodo(2026, 3)` | `Marzo 2026` (setiembre con "t") |
| `formatearDocumento("F001", "123")` | `F001-0000123` |

Los decimales llegan como **string** y se formatean con big.js (nunca `Number(...)` para importes). Separador de miles con coma y decimal con punto (`Intl.NumberFormat('es-PE')`). Negativos con signo menos.

## 10. Datos de demostración (obligatorio en este repo público)

| Dato | Valor de demostración |
|---|---|
| Empresa | EMPRESA DEMO S.A.C. · RUC `20000000001` |
| Proveedor | PROVEEDOR DEMO S.A.C. · RUC `20000000010` |
| Cliente | CLIENTE DEMO S.A.C. · RUC `20000000028` |
| Persona natural | PERSONA DEMO · DNI `00000001` · RUC `10000000006` |
| Cliente del exterior | EXPORT DEMO LTD · tipo 0, sin número |
| Usuarios | `admin@syp.invalid` (ADMIN del `.env.example` de la API), `contadora.demo@syp.invalid`, `asistente.demo@syp.invalid`, `consulta.demo@syp.invalid` (solo con `SEMILLA_DEMO=true`) |
| Productos | FIERRO, INOXIDABLE, COBRE (genéricos) con cantidades redondas (10.0000, 2.5000) y costos redondos (100.00, 1,000.00) |
| Comprobantes | `F001-0000123` (compra), `E001-0000045` (venta), `00-IT-2026` (merma), `00-AD-0001` (desmedro), `00-AI-0001` (ajuste) |

Estos RUC cumplen el dígito verificador y son los **únicos** que aceptan los hooks y `scripts/revisar-datos-publicos.mjs`. Nunca uses datos de `../inventario-syp-api/data` ni de los Excel en mocks, pruebas, capturas o documentación de este repo.

**Capturas de pantalla** (manual, README, presentaciones): solo con la API levantada sobre la **base de demostración** (en `inventario-syp-api`: `pnpm run db:demo` y luego `pnpm run start:demo`). Antes de agregar una imagen a este repo, una persona la revisa completa (también barras, pestañas y notificaciones) y copia en `docs/archivos-revisados.txt` la línea `<huella>  <ruta>` que `pnpm run revisar:datos` imprime para ese archivo; sin ese registro el script (y el CI) fallan.
