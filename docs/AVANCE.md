# AVANCE — inventario-syp-web

> Bitácora del frontend. Claude Code la lee al empezar cada sesión y la actualiza al terminar cada sprint (`/cerrar-sprint`).
> Formato por sprint: qué se hizo · decisiones · pendientes · cómo probar.
> La bitácora general del proyecto y las evidencias del TAP están en el repo privado de la API (`../inventario-syp-api/docs/AVANCE.md` y `../inventario-syp-api/docs/tap/`).

## Estado actual

| Sprint | Estado | Rama | Fecha de cierre |
|---|---|---|---|
| S0 Preparación | ✅ terminado (ver la bitácora de la API) | — | 18/10/2026 |
| S5 Base de la web | ✅ terminado | `sprint/05-base-web` | 25/10/2026 |
| S5 Corrección del CI (fix-ci) | ✅ terminado | `sprint/05-fix-ci` | 25/10/2026 |
| S6 Nube temprana (WEB) | ✅ terminado | `sprint/06-nube` | 27/10/2026 |
| S7 Maestros (WEB) | ✅ terminado | `sprint/07-maestros` | 06/11/2026 |
| S8 Operaciones (WEB) | ✅ terminado | `sprint/08-operaciones` | 07/11/2026 |
| S9 Kardex y periodos (WEB) | ✅ terminado | `sprint/09-kardex-periodos` | 15/11/2026 |
| S10 Libros y reportes (WEB) | ✅ terminado | `sprint/10-libros-reportes` | 15/11/2026 |
| S11 Contabilidad y control (WEB) | ✅ terminado | `sprint/11-contabilidad-control` | 21/11/2026 |
| S12 Dashboard y datos (WEB) | pendiente | `sprint/12-dashboard-datos` | |
| S13 Calidad y entrega (WEB) | pendiente | `sprint/13-calidad-entrega` | |

## Línea base (kit inicial, 08/10/2026)

- `CLAUDE.md`, `docs/UI-UX.md` (diseño y pantallas), `docs/CONTRATO-API.md`, `vercel.json`, `infra/` (Docker y Caddy para la red local) y la configuración de Claude Code con protección de datos reales (`node .claude/hooks/probar-hooks.mjs` → Hooks OK; `node scripts/revisar-datos-publicos.mjs` → SIN DATOS REALES).
- El código se genera desde el Sprint 5 (prompts en `../inventario-syp-api/docs/11-PROMPTS-CLAUDE-CODE.md`).

## Bitácora

<!-- /cerrar-sprint agrega aquí una sección por sprint -->

### S05 — base-web (25/10/2026)

Rama `sprint/05-base-web`.

**Qué se hizo**
- Plantilla `create-vite@9.2.1` (react-ts) movida a la raíz sin tocar los archivos del kit; `.gitignore` fusionado. Vite 8.3.5, React 19.3, oxlint 1.89.
- `package.json`: `inventario-syp-web`, `packageManager: pnpm@12.10.1`, `engines.node: 24.x`, TypeScript **5.9.3** con `"strict": true` explícito en `tsconfig.app.json` y `tsconfig.node.json` (`pnpm exec tsc -b` sin errores). Alias `@/*` → `src/*`. Scripts `test`, `test:cov`, `api:tipos` y `revisar:datos`.
- Dependencias con las versiones del plan: react-router 8.4.0, TanStack Query 5.104.1, TanStack Table 8.21.3, zod 4.6.5, react-hook-form 7.89.0, @hookform/resolvers 5.9.1, sonner 2.0.8, recharts 3.10.1, big.js 7.0.1, lucide-react; dev: tailwindcss y @tailwindcss/vite 4.3.3, vitest y @vitest/coverage-v8 4.1.11, Testing Library, jsdom, openapi-typescript 7.13.0. Ningún paquete nuevo en `allowBuilds`.
- Tailwind 4 con `@tailwindcss/vite` (sin `tailwind.config.js`) y **shadcn 4.22.1** (`init --base=radix --preset=nova`, sin preguntas). Los 30 componentes de `docs/UI-UX.md` §4 en `src/componentes/ui/`, todos disponibles (ninguno reemplazado). Tokens de §2 en `src/estilos/globals.css` (claro y `.dark`, `success`/`warning` registrados, `--radius`, pila del sistema, foco de 2 px con `--ring`).
- Router en modo datos (`src/app/router.tsx`): `/login`, `/cambiar-password`, `/` → `/inventario`, todas las rutas de §3 con sus roles (`src/app/paginas.ts` es la única definición, la usan el router y el menú) y `*` → Página no encontrada. Las pantallas que faltan muestran "En construcción · Sprint N".
- `src/api/cliente.ts`: base `/api/inventario/v1`, token solo en memoria (`lib/sesion.ts`), refresh single-flight + candado entre pestañas (`coordinacion-pestanas.ts`), un reintento tras 401, `CAMBIO_PASSWORD_REQUERIDO` → `/cambiar-password` sin refresh, errores `{codigo, mensaje, detalle}` → `ErrorApi` y mensajes de §6 (`lib/errores.ts`), "Despertando el servidor…" (`estado-servidor.ts` + `BannerServidor`). Tipos de `src/api/esquema.d.ts` generados con `pnpm run api:tipos`.
- `lib/formato.ts` (big.js, es-PE, fechas partiendo el texto, "Setiembre") y `lib/roles.ts` (`tieneRol('inventario', 'CONTADOR')`).
- Pantallas: Iniciar sesión, Cambiar contraseña (obligatoria si `debeCambiarPassword`, con indicador de seguridad en texto y barra), layout con Sidebar plegable a íconos filtrado por rol, encabezado con migas y menú de usuario (Cambiar contraseña, Tema claro/oscuro, Salir) e Inicio vacío.
- `vite.config.ts`: proxy `/api` → `API_PROXY_TARGET` con `loadEnv(mode, cwd, '')` (por defecto `http://localhost:3000`), también en `preview`; configuración de Vitest (jsdom).
- CI: `.github/workflows/ci.yml` copiado de `docs/referencia/ci-web.yml`.
- `docs/CONTRATO-API.md`: §3.1 `CAMBIO_PASSWORD_REQUERIDO`, §3.2 refresh entre pestañas, reglas de reintento de §4, `/auth/*` y `/usuarios` completos, y `/catalogos` con token.

**Decisiones**
- **Refresh entre pestañas**: `navigator.locks` y, si no existe, un candado con `BroadcastChannel`. El token **no viaja** por ningún canal: cada pestaña hace su propio refresh, de una en una. Por el canal solo pasan `refresh-terminado`, `logout` y, en el respaldo, `refresh-iniciado` con un id aleatorio (necesario para que el candado funcione sin Web Locks). Una prueba verifica que ningún mensaje contiene el token ni datos del usuario.
- **Reintentos**: 502/503 se repiten siempre; 504 o tiempo agotado solo en GET y login. Una escritura no se repite, para no duplicar comprobantes. El refresh tampoco se repite ante 504, porque reenviar una cookie ya rotada sería reutilización. Al abrir la app primero se despierta la API con `GET /salud` y después se hace el refresh silencioso.
- Un 401 `CREDENCIALES_INVALIDAS` nunca dispara refresh (tampoco en `cambiar-password`); un refresh con 429/5xx no cierra la sesión.
- **shadcn**: el CLI usa el paquete `cn` (oficial de shadcn: repositorio `shadcn-ui/cn`, reemplaza a clsx + tailwind-merge), `radix-ui`, `cmdk`, `class-variance-authority`, `tw-animate-css` y `shadcn` (su `tailwind.css`). Quitados: `@fontsource-variable/geist` (§2 pide la pila del sistema) y `next-themes` (inyecta un script en línea que la CSP bloquea): `ui/sonner.tsx` usa `app/tema.ts`. Ajustes en `ui/`: textos para lectores de pantalla en español (Cerrar, Más, Anterior/Siguiente, menú), Sidebar de 240 px y spinner "Cargando".
- El hook `vigilar-comandos.mjs` lee `vite` (en `init -t vite`) y `sonner` (en `add sonner`) como paquetes sin versión: se usaron `--template=vite` y `@shadcn/sonner`, que son equivalentes. No se tocó el hook; el equipo puede decidir si lo ajusta para `pnpm dlx shadcn@4 …`.
- `public/favicon.svg` de Vite reemplazado por un ícono propio: una coordenada de su trazo coincidía con un importe de la lista privada (falso positivo de `revisar:datos`).
- Carpetas que no están en el mapa de `CLAUDE.md`: `src/hooks/` (la crea shadcn: `use-mobile.ts`) y `src/pruebas/` (configuración y dobles de prueba).
- El tema (`inventario-syp:tema`) es lo único que va a `localStorage`.

**Pendientes**
- Selector de periodo y chip Abierto/Cerrado de la barra superior: con Periodos (S9). Etiqueta "DEMOSTRACIÓN": S13.
- Bundle de 689 kB: dividir con rutas *lazy* cuando existan pantallas reales (S7–S8).
- Revisión `revisor-ux` de Login, Cambiar contraseña y layout (contraste del foco en ambos temas).
- Advertencias de oxlint solo en archivos de shadcn (`only-export-components`, `set-state-in-effect`): sin cambios, porque `ui/` solo admite ajustes de estilo.

**Cómo probar**
```
pnpm install ; pnpm run lint ; pnpm test ; pnpm run build ; pnpm run revisar:datos
node .claude/hooks/probar-hooks.mjs
pnpm run dev  →  http://localhost:5173/login   (con la API en http://localhost:3000)
```
1. Con la base de demostración de la API (`pnpm run db:demo` y `pnpm run start:demo`) entra con `contadora.demo@syp.invalid` (o `admin@syp.invalid` en dev). Con una contraseña incorrecta debe salir "Correo o contraseña incorrectos…".
2. Si es el primer ingreso, la app lleva a Cambiar contraseña y no deja navegar hasta cambiarla (mínimo 12 caracteres).
3. En Inicio, el menú muestra solo lo que permite el rol (`consulta.demo@syp.invalid` no ve Compra, Merma ni Administración). Kardex muestra "En construcción · Sprint 9".
4. F5 mantiene la sesión (refresh silencioso). Con dos pestañas recargadas casi a la vez, ninguna pierde la sesión. **Salir** en una cierra también la otra.
5. Tema oscuro desde el menú de usuario; foco visible al recorrer con Tab.

**Números**: 61 pruebas en 8 archivos (cliente 20, coordinación 6, formato 9, roles 4, errores 5, login 8, ruta protegida 5, menú 4). Cobertura total 74 % de líneas; `cliente.ts` 92 %, `formato.ts` 100 %.

### S05 — fix-ci (25/10/2026)

Rama `sprint/05-fix-ci`. Corrige el CI de `main`, que falló en `pnpm audit --prod --audit-level high` con 2 vulnerabilidades altas:
- `zod` < 4.6.6 (GHSA-mrhx-c7xc-m3w5): por la dependencia directa `zod@4.6.5` y por `shadcn`.
- `body-parser` >= 2.0.0 < 2.4.0 (GHSA-27r3-jxmh-p828): solo por `shadcn` > `@modelcontextprotocol/sdk` > `express`.

**Qué se hizo**
- `shadcn` 4.22.1 pasa de `dependencies` a `devDependencies` (`pnpm remove shadcn` y `pnpm add -D shadcn@4.22.1`). Al reinstalarse, `body-parser` quedó en 2.4.0 (ya corregida).
- `zod` 4.6.5 → **4.6.6** (`pnpm add zod@4.6.6`); queda una sola versión en el árbol.
- `vitest` y `@vitest/coverage-v8` 4.1.11 → **4.1.12** (`pnpm add -D vitest@4.1.12 @vitest/coverage-v8@4.1.12`): corrige 2 moderadas solo de desarrollo en `@vitest/mocker` 4.1.11 (GHSA-qxg6-89mg-rqv8 y GHSA-xp26-3454-mjgp).
- Resultado: `pnpm audit --prod --audit-level high` y `pnpm audit` completo → sin vulnerabilidades.

**Decisiones**
- `shadcn` es un CLI: en el código solo aparece en `src/estilos/globals.css` (`@import "shadcn/tailwind.css"`), que Tailwind incorpora al CSS al compilar; el navegador nunca carga el paquete. Estaba en `dependencies` y por eso todo su árbol (servidor MCP, express…) contaba como producción. El CSS compilado sigue incluyendo las variantes `data-open`/`data-closed`, los tokens y `tw-animate-css`.
- Revisión de `dependencies`: ninguna otra herramienta de línea de comandos. `cn` trae un binario, pero es la librería de clases que importan los componentes de `ui/` y `lib/utils.ts`: se queda.
- Las moderadas de `@vitest/mocker` se resolvieron subiendo vitest dentro de la línea 4.1 del stack, **sin override**: un override habría desalineado los paquetes de vitest.

**Pendientes**
- Ninguno propio de esta corrección. Siguen los pendientes de S05 — base-web.

**Cómo probar**
```
pnpm install ; pnpm audit ; pnpm audit --prod --audit-level high
pnpm run lint ; pnpm test ; pnpm run test:cov ; pnpm run build ; pnpm run revisar:datos
node .claude/hooks/probar-hooks.mjs
pnpm run dev  →  http://localhost:5173/login   (con la API en http://localhost:3000)
```
1. Los dos `pnpm audit` deben decir "No known vulnerabilities found".
2. Con la base de demostración de la API, entra con `contadora.demo@syp.invalid` y abre el menú de usuario: se despliega con animación y los estilos son los mismos que antes (los aporta `shadcn/tailwind.css` aunque ahora sea dependencia de desarrollo).
3. En GitHub → Actions, el CI de `main` queda en verde.

**Números**: 61 pruebas en 8 archivos, todas en verde; cobertura 74,6 % de líneas (`cliente.ts` 91,8 %, `formato.ts` 100 %).

### S06 — nube (27/10/2026)

Rama `sprint/06-nube`. Tipos regenerados con `pnpm run api:tipos` (`/importacion/*` y `passwordTemporalExpira`).

**Qué se hizo**
- Pantalla **Importación y paridad** (`/inventario/configuracion/importacion`, solo ADMIN; `src/funcionalidades/importacion/`):
  - «Cargar histórico 2024–2026» con `DialogoConfirmacion`. 201 → resumen (terceros, saldos iniciales, comprobantes, movimientos, control de tonelaje, periodos, kardex recalculados y alertas, con el lote y su huella). 409 `HISTORICO_YA_CARGADO` → aviso informativo; 409 `NO_DISPONIBLE_EN_DEMO` → aviso de demostración.
  - 502/504 o tiempo agotado al cargar → aviso "La carga puede seguir procesándose en el servidor…" (no un error genérico).
  - «Verificar paridad»: tabla por año y producto (kardex, resumen mensual y libro 12.1: filas comparadas y diferencias BD / motor; nuevas y resueltas del libro; estado con ícono y texto), asientos por año, diferencia máxima, alertas y el detalle de cada diferencia tal como viene de la API.
  - Los dos botones se bloquean mientras corre cualquiera de las operaciones; mensaje en `aria-live` ("Puede tardar de 1 a 3 minutos") y esqueleto de la tabla.
- Revisión `revisor-ux` (aprobada con observaciones, sin hallazgos altos). Se corrigieron los 3 de severidad media:
  - `DialogoConfirmacion` acepta `focoAlCerrar`: al cancelar, pulsar Esc o confirmar, el foco vuelve al botón que lo abrió (antes caía en `<body>` porque el diálogo se abre controlado, sin `AlertDialogTrigger`).
  - Los botones se bloquean con `aria-disabled` (más un control en `onClick`) en vez de `disabled`, para que el foco no salte a `<body>`; «Reintentar» de paridad pasa antes el foco a «Verificar paridad». La región `aria-live` queda siempre montada y anuncia también el final ("Terminó la verificación de paridad: todo coincide.", "Terminó la carga del histórico.", etc.).
  - La diferencia máxima (BD y motor) se muestra con `formatearDiferencia` (`lib/formato.ts`): primero los 6 decimales de la tolerancia y, si no es exactamente 0, el valor exacto en notación legible: `2.58e-10` → `0.000000 (2.58 × 10⁻¹⁰)`; `0` → `0.000000`. Antes salía `2.58e-10` en bruto. Para lectores de pantalla, lo visible va con `aria-hidden` y un texto `sr-only` de `leerDiferencia` dice "0.000000, valor exacto 2.58 por 10 a la menos 10" (los superíndices no se leen igual en todos los lectores).
  - Tras cargar se invalidan kardex, stock, dashboard, periodos y comprobantes (`src/api/claves.ts`) y se descarta la paridad anterior.
- `api/cliente.ts`: opciones `tiempoMs` (tiempo por intento; por defecto 30 s) y `proxyPuedeCortar` (un 502 cuenta como "quizá llegó": una escritura no se repite). `api/importacion.ts` despierta primero la API con `GET /salud` y llama con 240 s por intento.
- Comunes nuevos de §4: `DialogoConfirmacion` (sin motivo; el motivo llega en el S8) y `EstadoError`. `lib/formato.ts`: `formatearEntero`, `formatearDiferencia` y `leerDiferencia`.
- `src/api/usuarios.ts`: tipo `Usuario` con `passwordTemporalExpira` (sin pantalla: es del S7).
- `vercel.json` revisado sin cambios: el rewrite ya apuntaba a la API en Render; `installCommand` con pnpm 12.10.1, rewrite de `/api/inventario/*` antes del fallback del SPA y CSP con `connect-src 'self'`, sin orígenes externos. Sin variables de entorno de Vercel.
- `docs/CONTRATO-API.md` §6.1 (importación y paridad) y la tabla de §6 reparada (dos párrafos la cortaban).

**Decisiones**
- Lo que el OpenAPI no trae no se inventa: paridad **sin `?anio`**, diferencia máxima **solo en el resumen** (la API la da una vez, no por fila) y **sin "Última carga"** (no hay endpoint).
- Antes de una operación larga se despierta la API con `GET /salud`: así el servidor dormido usa los reintentos normales y los 240 s cuentan solo para la operación.
- El POST del histórico nunca se repite solo: en la nube el proxy Vercel → Render puede cortar antes aunque la API siga trabajando. Repetirlo a mano es seguro (409 `HISTORICO_YA_CARGADO`).
- CSP sin cambios: `style-src 'unsafe-inline'` sigue porque Radix y sonner ponen estilos en línea; los scripts en línea ya están bloqueados.

**Pendientes**
- S12: "Última carga: fecha · lote" en esta pantalla (necesita un endpoint en la API).
- S13: endurecer la CSP (quitar `'unsafe-inline'` de `style-src` si Radix y sonner lo permiten, p. ej. con nonce o hashes).
- Siguen los pendientes del S05 (bundle de 719 kB → rutas *lazy*).
- Observaciones de severidad baja del `revisor-ux` (pendientes):
  - Boceto §5.19: faltan "Última carga" (ver pendiente del S12) y la columna "Dif. máxima" por fila (la API solo da la máxima global).
  - `resumen-carga.tsx`: la huella SHA-256 completa solo se ve en el `title` (no llega con teclado ni lector de pantalla) → `<details>` o botón «Copiar huella».
  - `tabla-paridad.tsx`: la lista con desplazamiento "Detalle de las diferencias" no es enfocable → `tabIndex={0}`, `role="region"`, `aria-labelledby` y anillo de foco.
  - `SIN_RESPUESTA` en «Verificar paridad» (una consulta) muestra el texto genérico "Si estabas guardando algo…" → mensaje propio de la consulta.
  - Con `SIN_RESPUESTA` o `HISTORICO_YA_CARGADO` al cargar no se invalidan kardex, stock, dashboard, periodos ni comprobantes (la carga pudo terminar en el servidor) → misma invalidación que tras el 201.
  - `aviso.tsx` une las clases con un template string → `cn()`.

**Cómo probar**
```
pnpm run lint ; pnpm test ; pnpm run build ; pnpm run revisar:datos
node .claude/hooks/probar-hooks.mjs
pnpm run dev  →  http://localhost:5173/inventario/configuracion/importacion   (API con pnpm run start:dev)
```
1. Entra como ADMIN (`admin@syp.invalid`, el ADMIN del `.env.example` de la API): el menú Administración muestra «Importación». Con `contadora.demo@syp.invalid`, `asistente.demo@syp.invalid` o `consulta.demo@syp.invalid` no aparece y la URL directa no deja entrar.
2. «Cargar histórico 2024–2026» → diálogo. Cancelar no hace nada; confirmar bloquea los dos botones y al terminar muestra el resumen. Una segunda carga muestra «El histórico ya estaba cargado».
3. «Verificar paridad» → tabla por año y producto, asientos, diferencia máxima con 6 decimales (y el valor exacto entre paréntesis si no es 0) y, si hay diferencias, su detalle.
4. Solo con teclado: Tab hasta «Cargar histórico», Enter, Esc → el foco vuelve al botón. Enter en «Verificar paridad» → el foco se queda en el botón mientras verifica y el lector de pantalla anuncia el final.
5. Con la API en modo demostración (`pnpm run start:demo`) los dos botones muestran el aviso de demostración.

**Números**: 81 pruebas en 9 archivos (página de importación 11, menú +3, cliente +2, formato +4).

### S07 — maestros (06/11/2026)

Rama `sprint/07-maestros`. Tipos regenerados con `pnpm run api:tipos` (26 rutas del S7 de la API).

**Qué se hizo**
- **Pantallas** (cargadas bajo demanda desde `src/app/pantallas-diferidas.tsx`):
  - **Productos** (`/inventario/maestros/productos`): stock, valor, CU, último movimiento y alertas (ícono y texto) desde `GET /productos/stock`, con selector de establecimiento. El código queda en solo lectura al editar. Tablas 5, 6 y 14 desde `/catalogos`; en la 14 solo el método 1. Crear y editar: A y C.
  - **Clientes y proveedores** (`/inventario/maestros/terceros`): la API pagina y busca (`?q=` con espera de 300 ms, filtro de rol). Validación en vivo con `GET /terceros/validar-documento`: 400 ms después de escribir y solo con el largo completo. Muestra "Documento válido", "Ya existe…" o el mensaje de RUC o DNI inválido, con `aria-live`. Con **tipo 0** no hay campo de número y se envía `null`. La razón social se guarda en mayúsculas y al editar solo va lo que cambió. Un 409 `TERCERO_DUPLICADO` se muestra junto al número. Crear y editar: A, C y S.
  - **Reglas contables** (`/inventario/maestros/reglas-contables`): **crear** con todos los campos y las operaciones filtradas por tipo de asiento (01/17, 13, 14, 28). **Editar** solo vigente hasta, decisión y descripción; el resto se muestra en solo lectura. **Cerrar regla** = poner vigente hasta. Estado Vigente o Cerrada con ícono y texto. Ante 409 `VIGENCIA_SUPERPUESTA` el diálogo muestra el mensaje, la vigencia pedida y las vigencias de las otras reglas del mismo tipo, producto y operación. A y C.
  - **Establecimientos** (`/inventario/maestros/establecimientos`): todos ven la lista; solo ADMIN crea y edita. El código (4 dígitos) no cambia y se propone el texto del libro `<código>-<nombre>`.
  - **Configuración** (`/inventario/configuracion`): pestañas Empresa, Libro 12.1 (con modo por año, `PUT libro-modo/:anio`), WinConta (19 columnas fijas) y Toma de inventario. Cada pestaña hace PATCH solo con su sección. **CONTADOR**: Libro y WinConta editables; Empresa y Toma en solo lectura (fieldset deshabilitado, sin Guardar y con el aviso "Solo lectura…"). Para él la página abre en Libro 12.1.
  - **Usuarios** (`/inventario/configuracion/usuarios`, ADMIN): crear con roles; editar nombre y roles; activar o desactivar con confirmación; restablecer la contraseña con confirmación. La **temporal se muestra una sola vez** con botón Copiar y el aviso "No se volverá a mostrar". "Temporal vencida: restablécela" sale cuando `passwordTemporalExpira` ya pasó. El ADMIN no ve "Desactivar" en su fila y no puede desmarcar su rol ADMIN.
- **Comunes** (`src/componentes/comunes/`):
  - `TablaDatos`: TanStack Table 8, con búsqueda (la tecla `/` la enfoca; sin distinguir tildes) y orden con botones y `aria-sort`. Paginación del cliente o del servidor, `caption`, `scope`, cifras a la derecha, cabecera fija, esqueleto y estado vacío.
  - `CampoDecimal` (con `lib/decimales.ts`), `SelectorTercero` (combobox con "+ Nuevo") y `Cifra`.
  - `IconoAlerta`, `CampoSelect` (`<select>` nativo), `Campo`, `CampoCasilla`, `DialogoFormulario` (Ctrl+Enter, Guardar deshabilitado al enviar, foco de vuelta al disparador), `EncabezadoPagina` y `EstadoActivo`.
  - `DialogoConfirmacion` ahora tiene `motivo: 'opcional' | 'obligatorio'` y `destructiva`.
  - `hooks/use-dialogo.ts`: abre el diálogo, cuenta las aperturas para usarlas como `key` y recuerda el disparador.
- **Permisos**: `lib/roles.ts` → `PERMISOS`, `puede()` y `usePuede()` (`productos:editar` A C · `terceros:editar` A C S · `reglas:editar` A C · `establecimientos:editar` A · `configuracion:empresa|toma` A · `configuracion:libro|winconta` A C · `usuarios:administrar` A).
- **Mensajes** (`lib/errores.ts` y UI-UX §6): `TERCERO_DUPLICADO`, `TERCERO_PROTEGIDO`, `PRODUCTO_DUPLICADO`, `ESTABLECIMIENTO_DUPLICADO`, `CODIGO_SUNAT_INVALIDO`, `CUENTA_INVALIDA`, `OPERACION_NO_CORRESPONDE`, `VIGENCIA_INVALIDA` y `PRODUCTO_INEXISTENTE` (`VIGENCIA_SUPERPUESTA` y `SIN_PERMISO` ya estaban). `camposConError` + `aplicarErrorDeApi` (`lib/formularios.ts`) colocan cada campo de un 400 `VALIDACION` junto a su control.
- `lib/formato.ts`: `formatearFechaHora` para instantes ISO (último acceso, vencimiento de la temporal).
- Pruebas: `src/pruebas/api-falsa.tsx` reemplaza `solicitar` y responde por ruta, así que los hooks reales de TanStack Query entran en la prueba. `configurar.ts` agrega lo mínimo de `ResizeObserver`, `scrollIntoView` y *pointer capture* para Radix y cmdk.
- `docs/CONTRATO-API.md` §6.2 (maestros, configuración y usuarios).

**Decisiones**
- **`<select>` nativo** (`CampoSelect`) en lugar del Select de Radix en los formularios. Es accesible con teclado y lector de pantalla sin trabajo extra, funciona con `register` y se prueba en jsdom. El combobox con búsqueda (`SelectorTercero`) sí usa `command` + `popover`.
- **Vigencia AAAA-MM como texto** (no `type="month"`, que Firefox de escritorio no muestra igual). AAAA-MM se compara como texto porque el orden alfabético coincide con el cronológico. El cruce de vigencias lo decide la API.
- **Diálogos remontados por `key`** en cada apertura, en lugar de reiniciarlos con `useEffect`: el formulario nace limpio y el lint no avisa `set-state-in-effect`.
- **PATCH con solo lo que cambió** en productos, terceros, reglas, establecimientos y usuarios, porque la API valida documento, códigos y cuentas solo si cambian. Un "Guardar" sin cambios cierra el diálogo sin llamar a la API.
- **Contraseña temporal fuera de la caché**: las mutaciones que la traen usan `gcTime: 0` y `reset()`, y vive solo en el estado del diálogo.
- **Stock**: la web solo junta producto con fila de stock del establecimiento elegido (por defecto, el primero activo). No suma ni calcula nada.
- **Configuración**: los enteros (decimales, mm, meses) se escriben como texto y se convierten con `parseInt` al enviar; no son importes. La tolerancia en TN viaja como string decimal (`CampoDecimal`, 4 decimales).
- Bundle principal: 719 kB → **472 kB** (el pendiente del S05), con `React.lazy` + `Suspense` y un esqueleto mientras carga.
- `02-REGLAS-DE-NEGOCIO.md` §17 no se puede leer desde este repo (lo bloquea `proteger-lectura`): los códigos se tomaron del AVANCE del S7 de la API.
- Advertencia de oxlint `incompatible-library` en `tabla-datos.tsx`: es propia de TanStack Table con el React Compiler. Sin cambios.

**Pendientes**
- Capturas `S07-productos.png`, `S07-terceros-ruc.png`, `S07-reglas-vigencia.png` y `S07-configuracion.png`, solo con la base de demostración. Cada una se registra en `docs/archivos-revisados.txt`.
- S8: usar `SelectorTercero` en Compra y Venta, y `DialogoConfirmacion` con motivo obligatorio en Anular.
- S9: la API responderá 409 `PERIODO_CERRADO` si la vigencia de una regla toca un mes cerrado (D-29). Su mensaje ya existe en `lib/errores.ts`.

**Cómo probar**
```
pnpm run lint ; pnpm test ; pnpm run build ; pnpm run revisar:datos
node .claude/hooks/probar-hooks.mjs
pnpm run dev  →  http://localhost:5173/inventario/maestros/productos   (API con pnpm run start:dev o start:demo)
```
1. Como ADMIN (`admin@syp.invalid`): crea un establecimiento, un producto, un proveedor y una regla.
   - Proveedor: escribe `20000000028` y debe salir "Documento válido."; con `20000000010` sale "Ya existe…".
   - Regla: una con vigencia cruzada debe mostrar el 409 con las fechas.
2. En **Usuarios**, crea `contadora.prueba@syp.invalid` con el rol Contador. Copia la temporal (se muestra una sola vez), cierra sesión, entra con ella y cámbiala.
3. Como esa CONTADOR:
   - edita productos, terceros y reglas, y guarda Libro 12.1 y WinConta;
   - Empresa y Toma de inventario se ven en solo lectura;
   - no ve Usuarios, Importación ni los botones de Establecimientos.
4. `consulta.demo@syp.invalid` (base demo): solo listas, sin Nuevo, Editar ni Cerrar.
5. Solo con teclado: `/` enfoca el buscador, Enter ordena desde el encabezado, Ctrl+Enter guarda y Esc cierra el diálogo con el foco de vuelta al botón.

**Revisión `revisor-ux`**: APROBADO CON OBSERVACIONES, sin hallazgos altos ni datos reales. Se corrigieron los 5 de severidad media:
- Terceros: el error "Marca si es proveedor, cliente o ambos" se asocia al fieldset y a las dos casillas (`aria-describedby` y `aria-invalid`). "Activo" sale del grupo "Rol".
- WCAG 2.5.3 (el nombre accesible contiene el texto visible): «Cerrar regla RC-nn» y «Restablecer contraseña de …».
- Contraseña temporal: un clic fuera ya no cierra el diálogo (Esc sí, por §6).
- Configuración: las pestañas quedan montadas (`forceMount` + `hidden`), así que cambiar de pestaña no borra lo que no se guardó. El `reset` tras guardar usa `keepDirtyValues`. Lo cubre una prueba nueva.

También se corrigieron tres de severidad baja:
- Los errores de Usuarios persisten (`duration: Infinity`).
- `TablaDatos` muestra "Sin datos para mostrar." (no "Aún no hay…") cuando falla la carga.
- En `SelectorTercero`, `aria-controls` solo se pone con el popover abierto.

Bajas pendientes:
- Marcar en su campo los 400 `VALIDACION` de PATCH /configuracion.
- Acción "Nuevo …" dentro de los estados vacíos.
- Bloquear los botones de la fila de Usuarios mientras se guarda.
- Estado "Desde {mes}" para reglas con vigencia futura.

**Números**: 143 pruebas en 19 archivos (+62: tabla 7, campo decimal 4, confirmación 3, selector 3, terceros 10, productos 5, establecimientos 3, reglas 8, configuración 8, usuarios 7, roles +1, errores +2, formato +1). Cobertura total 88,2 % de líneas; `tabla-datos.tsx` 96 %, `roles.ts` 100 %.

### S08 — operaciones (07/11/2026)

Rama `sprint/08-operaciones`. Tipos regenerados con `pnpm run api:tipos` (35 rutas; +10 de comprobantes y movimientos).

**Qué se hizo**
- **Pantallas** (cargadas bajo demanda): Registrar compra, venta o exportación, merma o desmedro y ajuste (`/inventario/{compras,ventas,mermas}/nueva`, `/ajustes/nuevo`), Comprobantes (`/inventario/comprobantes`) y su detalle (`/:id`, con `?editar=1`).
- **Formulario único** (`funcionalidades/comprobantes/formulario/`) para las cuatro operaciones, al registrar y al editar:
  - varias líneas (producto, descripción, cantidad TN, costo o valor de venta, importe);
  - `Alt+N` agrega una línea y enfoca su producto; `Ctrl+Enter` guarda; «Guardar y nueva» conserva fecha y establecimiento;
  - totales con big.js rotulados "vista previa";
  - zod con mensajes en español.
- **Venta**: 01 factura / 03 boleta; operación 01 / 17. Con **03** la operación queda en 01, la opción 17 se deshabilita y aparece la ayuda "La exportación requiere factura" (también se fuerza en zod y al convertir). PEN o USD; con USD el tipo de cambio es obligatorio (3 decimales). Cada línea muestra "Disponible al dd/mm: X TN · costo estimado S/ Y" (`simular-salida`, 400 ms después de escribir) y avisa con ícono y texto si queda negativo.
- **Merma o desmedro**: 13 con año del informe y documento `00-IT-<año>` de vista previa; 14 con "lo asigna la API (00-AD-…)". Sustento obligatorio, con su ayuda según el tipo.
- **Ajuste**: operación 28, sustento obligatorio. Cada línea es una entrada al costo promedio, una entrada con costo informado o una salida al promedio.
- **Comprobantes**:
  - filtros (desde, hasta, naturaleza, tercero, producto, estado) y búsqueda por serie o número; paginación del servidor;
  - columnas: Fecha · Tipo · Serie-Número · Tercero · Productos · TN · Moneda · Estado; los anulados, tachados, en gris, con ícono, el texto "Anulado" y el motivo;
  - **Ver**: panel lateral con las líneas y su **efecto en el kardex** (orden, CU, costo, saldo TN/CU/S/, alertas);
  - **Editar**: PATCH con solo lo que cambió; las líneas conservan su `id`;
  - **Anular**: motivo obligatorio y texto que repite el efecto.
- **Errores** (`errores-operacion.ts`, función pura con una prueba por código):
  - 409 `STOCK_NEGATIVO_REQUIERE_CONFIRMACION` → `DialogoStockNegativo` (producto, fecha, disponible antes, saldo resultante) y reenvío **de la misma petición** con `confirmarStockNegativo: true`. Sirve al registrar, editar y anular.
  - `STOCK_INSUFICIENTE` → aviso sin opción de confirmar.
  - `PERIODO_CERRADO` → aviso con el mes según la fecha + error en Fecha.
  - `ORDEN_EN_CONFLICTO` → aviso con **Reintentar**, que reenvía lo mismo y nunca se ejecuta solo.
  - `COMPROBANTE_DUPLICADO` → junto al Número ("Ya existe la factura F001-0000123 de este proveedor").
  - `COMPROBANTE_ANULADO` → aviso y formulario en solo lectura.
  - 422 (`PRECIO_VENTA_REQUERIDO`, `TIPO_CAMBIO_REQUERIDO`, `SUSTENTO_REQUERIDO`, `SALDO_INICIAL_INEXISTENTE`, `TERCERO_INEXISTENTE`, `ESTABLECIMIENTO_INEXISTENTE`) → junto a su campo.
  - 403 de un ASISTENTE al editar → "Solo puedes editar las compras y ventas que registraste tú.".
  - 400 `VALIDACION` → cada error en su campo; `terceroId` y `costoUnitario`/`valorVentaUnitario` se traducen al campo del formulario.
- `useEscritura`: un solo lugar para la confirmación de stock negativo, el reintento y la invalidación (kardex, stock, dashboard, periodos, comprobantes y productos).
- **Comunes**: `DialogoStockNegativo`, `CampoFecha`, `SelectorProducto` y `Aviso`. `Aviso` viene de importación y ahora tiene tono error, acciones y usa `cn()`, lo que resuelve una observación baja del S6. `SelectorTercero` acepta un tercero resumido y un `ref`. `EncabezadoPagina` acepta `refTitulo`.
- **Permisos** (`lib/roles.ts`): `compras:registrar` y `ventas:registrar` (A, C, S), `mermas:registrar` y `ajustes:registrar` (A, C), `comprobantes:anular` (A, C) y `puedeEditarComprobante` (A y C, todo lo registrado; S, solo compras y ventas).
- **Mensajes** (`lib/errores.ts` y UI-UX §6):
  - `PERIODO_CERRADO` con el texto unido aprobado ("El mes de {mes} está cerrado: no se puede registrar ni modificar. Pide reabrirlo si necesitas cambiarlo.");
  - nuevos: `ORDEN_EN_CONFLICTO`, `TERCERO_INEXISTENTE`, `ESTABLECIMIENTO_INEXISTENTE` y `SALDO_INICIAL_INEXISTENTE` (con el año);
  - `STOCK_INSUFICIENTE` ahora incluye el producto.
- `lib/formato.ts`: `hoyIso()` (hoy en Lima, con `Intl`). `lib/stock-negativo.ts`: lectura tolerante del detalle del 409.
- Pruebas: `renderizarEnRuta` (router de memoria) en `pruebas/api-falsa.tsx` y datos de demostración en `pruebas/comprobantes-demo.ts`. `vite.config.ts` tiene `testTimeout: 15_000` (ver Decisiones).
- Documentación: `CONTRATO-API.md` §6.3 (comprobantes y dónde se muestra cada error) y `UI-UX.md` §5.4 (boleta) y §6.

**Decisiones**
- **ASISTENTE y "sus" comprobantes**: `ComprobanteDto` no dice quién lo creó, así que la web le muestra «Editar» en todas las compras y ventas y la API decide con 403, que se muestra con un mensaje propio. Aprobado por el equipo.
- **El mes cerrado se detecta al guardar** (409) en este sprint; el aviso previo y el Guardar deshabilitado llegan con `/periodos` en el S9. Aprobado.
- **Un solo formulario** para las cuatro operaciones y para editar: los mismos atajos, errores y accesibilidad en todas.
- **«Guardar» con `aria-disabled`** (no `disabled`) mientras envía o en solo lectura, para no perder el foco al confirmar el stock negativo; los clics se ignoran.
- **Columna TN de la lista**: suma de las líneas con big.js. Es una vista, no un saldo.
- Mover un movimiento (`POST /movimientos/:id/mover`) queda para el Kardex (S9); su mensaje (`REORDEN_FUERA_DE_FECHA`) ya existe.
- `testTimeout` de 15 s: con la PC cargada fallaban por tiempo algunas pruebas del S7 y del S8 que escriben con `user-event` (la batería tardó entre 26 y 68 s). Con 15 s, 3 ejecuciones seguidas pasaron completas.

**Pendientes**
- **API del S9**:
  - agregar `creadoPorId` a `ComprobanteDto`, para ocultar «Editar» al ASISTENTE en lo que no registró;
  - documentar en el OpenAPI los códigos `ORDEN_EN_CONFLICTO`, `TERCERO_INEXISTENTE` y `ESTABLECIMIENTO_INEXISTENTE`, y la forma del `detalle` de `STOCK_NEGATIVO_REQUIERE_CONFIRMACION`.
- **S9 (web)**:
  - mes cerrado antes de guardar (aviso, fecha marcada y Guardar deshabilitado) con `/periodos`;
  - mover movimientos en el Kardex.
- Bajas del `revisor-ux` sin corregir:
  - motivo de anulación solo en `title` en la lista (el panel «Ver» y los lectores de pantalla sí lo tienen) → Tooltip enfocable;
  - el `SelectorProducto` y los chips no llevan el punto de color de §4, porque `ProductoDto` no trae un color. Se agregará si la API lo incluye; el `<select>` nativo se mantiene por accesibilidad;
  - "Descripción con sugerencias de las usadas antes" (§5.3): no hay un endpoint para obtenerlas.
- Capturas `S08-*.png` (omitidas al cierre; las toma el equipo después), solo con la base de demostración. Cada imagen que entre a este repo se registra en `docs/archivos-revisados.txt`, y la evidencia del TAP en `../inventario-syp-api/docs/tap/05-EVIDENCIAS.md`.
- Probar con la API local la merma, el desmedro y el ajuste. El equipo ya probó contra la base demo la compra, la venta con stock negativo, la exportación en USD y la anulación.

**Cómo probar**
```
pnpm run lint ; pnpm test ; pnpm run build ; pnpm run revisar:datos
pnpm run dev  →  http://localhost:5173/inventario/compras/nueva   (API con pnpm run start:dev o start:demo)
```
1. Como CONTADOR (`contadora.demo@syp.invalid`), registra una compra de FIERRO de PROVEEDOR DEMO S.A.C. (`F001`-`123`) con dos líneas.
   - Usa Alt+N para agregar la segunda línea y Ctrl+Enter para guardar.
   - Debe salir el toast "Compra F001-0000123 registrada · kardex recalculado" y abrirse el detalle con el efecto en el kardex.
   - Si registras la misma factura otra vez, debe salir "Ya existe la factura F001-0000123 de este proveedor." junto al Número.
2. Registra una venta a CLIENTE DEMO S.A.C.
   - Con 03 Boleta, la operación 17 se deshabilita.
   - Con 01, 17 y USD, se pide el tipo de cambio y cada línea muestra el disponible.
   - Si vendes más de lo disponible, aparece el diálogo de stock negativo; «Registrar de todos modos» la guarda.
3. Registra una merma 13 (documento `00-IT-<año>`), un desmedro 14 y un ajuste con una entrada con costo y una salida.
4. En Comprobantes:
   - filtra por Ventas;
   - abre «Ver»;
   - edita el número de una compra (solo se envía ese campo);
   - anula con motivo: la fila queda tachada, con "Anulado".
5. Como `asistente.demo@syp.invalid`: no ve Merma, Ajuste ni «Anular», y ve «Editar» solo en compras y ventas. Como `consulta.demo@syp.invalid`: solo «Ver».

**Revisión `revisor-ux`**: APROBADO CON OBSERVACIONES, sin hallazgos altos ni datos reales. Se corrigieron los 4 de severidad media:
- Confirmar el stock negativo ya no deja el foco en `<body>`: «Guardar» usa `aria-disabled`.
- El primer error en Proveedor/Cliente enfoca el combobox: `SelectorTercero` acepta `ref`.
- Al quitar una línea, el foco pasa al producto de la línea que ocupa su lugar.
- Al anular, el foco pasa al título de la página, porque el botón «Anular» desaparece.

También se corrigieron 4 de severidad baja:
- Los errores que van solo al encabezado (y el conflicto) enfocan el aviso.
- El total de vista previa ya no tiene `aria-live`.
- La simulación solo anuncia el resultado, no "Consultando…".
- Al guardar o cancelar la edición, el foco vuelve a «Editar».

**Prueba del equipo contra la API (base demo)**: compra de 2 líneas, venta con el diálogo de stock negativo, exportación en USD con tipo de cambio obligatorio y anulación con motivo: todo funciona. Arreglo posterior: en los filtros de Comprobantes, el texto del selector de Tercero se desbordaba sobre el de Producto. Ahora muestra "RUC o razón social" (el texto completo queda como descripción accesible, `textoVacio` de `SelectorTercero`) y el botón usa `min-w-0` y `truncate`. Los filtros Tercero y Producto ocupan todo el ancho en celular y 18 rem y 14 rem desde `sm`.

**Números**: 207 pruebas en 24 archivos (+64):
- `paginas-registro` 15;
- `pagina-comprobantes` (lista y detalle) 14;
- `errores-operacion` 16 (con `it.each`);
- `esquemas` 12;
- `DialogoStockNegativo` 3;
- `roles` +2 y `errores` +2.

### Cambio de equipo (06/11/2026)

- Cambio de integrantes y de cuenta de GitHub (ver D-30 en la API).

### S09 — kardex-periodos (15/11/2026)

Rama `sprint/09-kardex-periodos`. Tipos regenerados con `pnpm run api:tipos` (+11 rutas: kardex, alertas, recalcular, periodos, cerrar, reabrir, cerrar en bloque, vista previa y confirmación del cierre anual, saldos iniciales). `ComprobanteDto` trae ahora `creadoPorId` y `creadoPor`.

**Qué se hizo**
- **Kardex** (`/inventario/kardex`, todos):
  - filtros en la URL (`?producto&anio&mes=N|todo&detallado=1`), no en `localStorage`; sin `mes` se usa el mes en curso;
  - tabla "tipo Excel" propia (`tabla-kardex.tsx`): Fecha · Comprobante · Op · Tercero/descripción y los grupos ENTRADAS / SALIDAS / SALDO con Cant., C.U. y Total; fila SALDO INICIAL y subtotal por mes en negrita (`bg-muted`) con el estado del mes; cabecera y las columnas Fecha y Comprobante fijas al desplazarse; «Detallado» agrega RUC/DNI y la descripción completa;
  - valores de `GET /kardex` tal cual, formateados con big.js: cantidades 4 decimales, C.U. y totales 2, miles con coma, negativos con signo, ícono y texto "(negativo)";
  - alertas con ícono y texto (⛔ Stock negativo, ↕ Fecha anterior al movimiento previo, ⚠ Saldo cero con costo, ⚠ SI desactualizado); resumen de `GET /kardex/alertas?anio` en un aviso superior con la lista desplegable y enlace a cada fila (`#fila-<movimientoId>`: la fila se resalta y recibe el foco);
  - clic en una fila (o en su documento) → panel lateral con el comprobante y «Abrir el comprobante»;
  - **Reordenar** (A, C): ↑/↓ solo entre movimientos de la misma fecha y en meses no cerrados, con confirmación que explica que el orden cambia el costo de las salidas del día; maneja stock negativo y conflicto;
  - **Recalcular** (solo A): confirmación; recalcula el producto y año elegidos y avisa si quedaron saldos iniciales desactualizados.
- **Periodos** (`/inventario/periodos?anio`, todos ven):
  - doce tarjetas con estado (ícono + texto), movimientos, libro 12.1 (impreso el dd/mm/aaaa o "Pendiente") y asiento (exportado (n.º) o "Pendiente"), y quién y cuándo cerró;
  - **Cerrar mes** (A, C; solo si el mes anterior no está abierto y no es futuro): diálogo que lista antes los saldos negativos del mes (`/kardex/alertas`, no bloquean); tras cerrar, aviso con los `saldosNegativos` y las diferencias con el cierre anterior que devuelve la API;
  - `CIERRE_CON_SALDO_CERO_CON_COSTO`: el diálogo sigue abierto y lista los movimientos con enlace al kardex;
  - **Reabrir** (A, C; solo el último mes cerrado): motivo obligatorio con zod (mismo límite que la API: 500); muestra las advertencias de la API;
  - **Cerrar en bloque** (solo A): desde–hasta (`AAAA-MM`) y una confirmación que repite el rango.
- **Cierre anual** (`/inventario/periodos/cierre-anual?anio`, A y C), asistente de 3 pasos:
  1. meses abiertos (no deja avanzar);
  2. saldo final, propuesto, existente (con origen y ⚠ desactualizado), diferencias con signo (`+0.01`) y resaltadas, comparación con ícono y texto, y advertencia si el propuesto queda negativo;
  3. «Reemplazar el saldo inicial existente» (`confirmarReemplazo`) o «Conservar los existentes» (`conservarExistentes`), obligatorio si hay diferencias, y la casilla de stock negativo cuando corresponde.
  - `SALDO_INICIAL_REQUIERE_CONFIRMACION` → vuelve al paso 2 con el mensaje; `CIERRE_ANUAL_INCOMPLETO` → paso 1; 409 de stock negativo → `DialogoStockNegativo` y reenvío.
- **Saldos iniciales** (`/inventario/saldos-iniciales?anio`, todos): cantidad, total, origen (Importación, Cierre anual, Manual), ⚠ "Desactualizado", motivo y quién lo registró. A y C editan un saldo como manual (`PUT /saldos-iniciales/:id`): zod, decimales como texto (`CampoDecimal`, 4 y 10 decimales), motivo obligatorio, stock negativo con confirmación.
- **Pendientes del S8 resueltos**:
  - formularios de compra, venta, merma, ajuste y Editar comprobante: si el mes de la fecha está cerrado (`GET /periodos?anio`, `useEstadoMes`), la Fecha muestra "El mes está cerrado. Para registrar o editar, un usuario Contador o Administrador debe reabrirlo en Periodos" y «Guardar» queda deshabilitado (`aria-disabled`); el 409 `PERIODO_CERRADO` se sigue manejando;
  - «Editar» oculto al ASISTENTE en los comprobantes que no registró (`creadoPorId` = id de la sesión) y «Registrado por» en el detalle;
  - `ORDEN_EN_CONFLICTO` y `CONFLICTO_CONCURRENTE`: `AvisoConflicto` ("Otro usuario modificó estos datos al mismo tiempo") con **Reintentar, que vuelve a cargar los datos y no reenvía** (en formularios, anular, mover, cerrar, reabrir, cerrar en bloque, cierre anual y saldo manual). Al editar, recarga el comprobante y el formulario;
  - chip del estado del **mes en curso** en la barra superior (enlaza a Periodos).
- **Comunes y utilidades**: `ChipEstadoPeriodo`, `AvisoConflicto`, `SelectorPeriodo`; `IconoAlerta` con `LIBRO_PENDIENTE_IMPRESION`; `Cifra` con el tipo `importe` (2 decimales sin "S/"); `lib/periodos.ts` (años, `anioDeUrl`, textos de estado), `lib/alertas.ts` (textos de alertas); `invalidarTrasEscritura` pasa a `api/claves.ts` e incluye `alertas` y `saldosIniciales`.
- **Permisos** (`lib/roles.ts`): `kardex:reordenar` (A, C), `kardex:recalcular` (A), `periodos:cerrar` (A, C), `periodos:cerrar-en-bloque` (A), `periodos:cierre-anual` (A, C), `saldos:editar` (A, C); `puedeEditarComprobante` compara `creadoPorId`.
- **Mensajes** (`lib/errores.ts` y UI-UX §6): `CONFLICTO_CONCURRENTE`, `PERIODO_FUTURO`, `PERIODO_ANTERIOR_AL_INICIO`, `PERIODO_NO_CERRADO`, `CIERRE_CON_SALDO_CERO_CON_COSTO` (con el mes) y `SALDO_INICIAL_REQUIERE_CONFIRMACION` (con el año).
- Documentación: `CONTRATO-API.md` §6.3 (actualizado) y §6.4 (nuevo); `UI-UX.md` §4, §5.9, §5.10 y §6.

**Decisiones**
- **Reintentar ante un conflicto recarga y no reenvía** (cambia la decisión del S8, que reenviaba): la persona ve los datos nuevos y decide. Aprobado por el equipo.
- **Saldos iniciales sin columna C.U.**: `SaldoInicialDto` no la trae y dividir costo entre cantidad sería calcular en la web. Se agregará cuando la API la entregue. Aprobado.
- **Tarjetas de periodos sin TN de compras y ventas ni número de movimientos**: `PeriodoDto` solo trae `tieneMovimientos`; sumar en la web sería calcular. Se muestra "Con movimientos / Sin movimientos". Aprobado.
- **Chip del mes en curso** en la barra superior; el selector del periodo de trabajo (§3) queda para otro sprint. Aprobado.
- **Advertencias antes de cerrar** desde `GET /kardex/alertas` (la API no tiene vista previa del cierre; los `saldosNegativos` oficiales llegan después de cerrar).
- **`CIERRE_CON_SALDO_CERO_CON_COSTO`**: el OpenAPI no documenta su `detalle`; se lee de forma tolerante (`movimientos[]` o `filas[]`) y, si no viene, se usan las alertas `SALDO_CERO_CON_COSTO` del mes.
- **Tabla del kardex propia** (no `TablaDatos`): necesita encabezados agrupados, filas de saldo y subtotales. Solo se fijan Fecha y Comprobante para no tapar la tabla en pantallas medianas.
- **Saldo manual**: solo se edita uno existente; la API aún no tiene un alta para un producto y año sin saldo.
- **Cerrar un mes**: se ofrece si el mes anterior del año no está abierto y no es posterior al mes en curso (Lima). Enero depende de diciembre del año anterior: lo valida la API (`PERIODO_ANTERIOR_ABIERTO`).

**Pendientes para la API (Sprint 10)**
- PeriodoDto: número de movimientos y TN de compras y ventas del mes, calculados en la API.
- PeriodoDto: estado "desactualizado" del libro 12.1 y del asiento.
- Documentar en el OpenAPI el detalle de CIERRE_CON_SALDO_CERO_CON_COSTO (lista de movimientos).
- SaldoInicialDto: costoUnitario.
- Endpoint para crear un saldo inicial manual cuando no existe para un producto y año.
- Vista previa de las advertencias antes de cerrar un mes (opcional).

**Pendientes (web)**
- Exportar el kardex a Excel y el PDF del 13.1 (Sprint 10).
- Selector del periodo de trabajo en la barra superior (§3).
- El paquete inicial (`index-*.js`) quedó en ~501 kB y Vite muestra la advertencia de 500 kB: revisar la división en el S13.
- Capturas `S09-*.png`, solo con la base de demostración y registradas en `docs/archivos-revisados.txt`.

**Cómo probar**
```
pnpm run lint ; pnpm test ; pnpm run build ; pnpm run revisar:datos
pnpm run dev  →  http://localhost:5173/inventario/kardex   (API con pnpm run start:demo)
```
1. Como CONTADOR (`contadora.demo@syp.invalid`), abre Kardex, elige FIERRO, el año y un mes. Compara cada cifra con `GET /kardex` (cantidades 4 decimales; C.U. y totales 2). Cambia a "Todo el año" y marca «Detallado»: la URL cambia y se puede recargar.
2. En el aviso de alertas, abre la lista y sigue un enlace: la fila queda resaltada. Haz clic en una fila: se abre el panel con el comprobante.
3. Con dos movimientos del mismo día, usa ↑/↓: aparece la confirmación y el kardex se recalcula.
4. En Periodos, cierra el primer mes abierto (revisa las advertencias), reabre el último cerrado (el motivo es obligatorio) y, como ADMIN (`admin.demo@syp.invalid`), cierra en bloque un rango.
5. Con un mes cerrado, abre Registrar compra con una fecha de ese mes: aviso en la Fecha y «Guardar» deshabilitado.
6. En Cierre anual del año anterior, recorre los 3 pasos y elige reemplazar o conservar. En Saldos iniciales del año siguiente revisa el origen y edita uno como manual.
7. Como `asistente.demo@syp.invalid`: no ve «Editar» en comprobantes que no registró, ni Reordenar, Recalcular, Cerrar o Cierre anual. Como `consulta.demo@syp.invalid`: solo lectura.

**Números**: 255 pruebas en 29 archivos (+45 y +5 archivos):
- `pagina-kardex` 13 (filtros en la URL, formato 4/2 decimales con miles y negativos, alertas con texto, panel, vacío/error, permisos, mover con confirmación, conflicto, recalcular);
- `pagina-periodos` 14 (utilidades, tarjetas, permisos, cerrar con advertencias, saldo cero con costo, `PERIODO_FUTURO`/`PERIODO_ANTERIOR_AL_INICIO`, conflicto, reabrir con motivo, `PERIODO_NO_CERRADO`, cerrar en bloque);
- `pagina-cierre-anual` 5 (meses abiertos, diferencias con signo, reemplazar/conservar, `SALDO_INICIAL_REQUIERE_CONFIRMACION`, stock negativo);
- `pagina-saldos-iniciales` 4 y `encabezado` 2;
- `paginas-registro` 17 (conflicto que recarga y mes cerrado), `pagina-comprobantes` 15 (Editar del ASISTENTE y «Registrado por»), `errores-operacion` 17, `errores` 13 y `roles` 9.

**Revisión `revisor-ux`**: APROBADO CON OBSERVACIONES, sin hallazgos altos ni datos reales. Se corrigieron las 3 de severidad media (contraste AA en el tema claro):
- `ChipEstadoPeriodo`, «Diferente» del cierre anual e `IconoAlerta`: el color va solo en el ícono (y el borde); el texto queda en `text-foreground`.

También se corrigieron 6 de severidad baja:
- clic en una fila del kardex: el foco vuelve al botón del comprobante de esa fila;
- el hover de la fila llega a las columnas fijas (`group-hover`);
- la línea "Cerrado el…" de la tarjeta ahora es un `dt`/`dd` válido dentro del `dl`;
- sin elegir Reemplazar/Conservar, el foco va a la primera opción;
- la diferencia negativa del cierre anual lleva ícono y "(negativo)" para lectores de pantalla, como `Cifra`;
- Cerrar en bloque: `placeholder="AAAA-MM"` y ayuda (Firefox y Safari no tienen `type="month"`).

La séptima (el estado "desactualizado" del libro 12.1 y del asiento) depende de la API: está en los pendientes para el Sprint 10. Además, al cerrar un mes, el foco pasa al aviso del resultado o al título, porque el botón «Cerrar mes» desaparece.

**Pruebas manuales con la API en modo demostración (15/11/2026)**: aprobadas por el equipo. Se revisaron el kardex contra `GET /kardex`, las alertas, el panel lateral, periodos, cerrar en bloque, `PERIODO_FUTURO`, el mes cerrado en el formulario, el cierre anual, el saldo manual y los roles ADMIN, ASISTENTE y CONSULTA. Después se hicieron dos ajustes visuales:
- **Periodos**: las 12 tarjetas tienen el mismo ancho y alto (`w-full` y `auto-rows-fr`), en 1 columna en celular, 2 en tablet y 4 en escritorio. Antes las cerradas salían más anchas.
- **Panel lateral del kardex**: hasta 36rem en tablet y 64rem en escritorio (`data-[side=right]:sm:max-w-xl` y `lg:max-w-5xl`). El `max-w-sm` del `Sheet` de shadcn anulaba el ancho anterior. Desde 1366 px, la serie-número entra en una sola línea y la tabla «Líneas y efecto en el kardex» (mínimo 60rem) no muestra barra horizontal.

### S10 — libros-reportes (15/11/2026)

Rama `sprint/10-libros-reportes`. Tipos regenerados con `pnpm run api:tipos` desde el OpenAPI de la API (parte API del S10 en `main`, commit `b3b123a`): libros 12.1 y 13.1, impresiones, reportes, `POST /saldos-iniciales`, `PeriodoDto` ampliado, `SaldoInicialDto.costoUnitario` y `ErrorSaldoCeroDto`.

**Qué se hizo**
- **Pendientes del S9 que resolvió la API**:
  - **Periodos**: cada tarjeta muestra el número de movimientos, las TN de compras y ventas y el detalle «Por producto» (desplegable), todo de `PeriodoDto`. El libro 12.1 sale de `PeriodoDto.libro121` (Pendiente / ✓ Impreso dd/mm/aaaa / ⚠ Desactualizado) con el enlace «Ver libro 12.1» al mes. `libroImpreso` (obsoleto) ya no se usa. El asiento sigue "Pendiente" (S11).
  - **Saldos iniciales**: columna C.U. (`costoUnitario` de la API, 2 decimales) y **Nuevo saldo manual** (A, C; `POST /saldos-iniciales`):
    - producto (solo activos sin saldo en el año), cantidad y costo total como texto, motivo obligatorio;
    - stock negativo → `DialogoStockNegativo` y reenvío;
    - `SALDO_INICIAL_YA_EXISTE` → aviso junto al producto y recarga de la tabla.
  - **Cerrar mes**: `saldo-cero.ts` lee el detalle tipado de `CIERRE_CON_SALDO_CERO_CON_COSTO` (`ErrorSaldoCeroDto`). Si no viene, se mantiene el respaldo con las alertas del mes.
- **Libro 12.1** (`/inventario/libros/12-1`, todos):
  - filtros en la URL como el kardex (año, mes o "Todo el año", producto o "Todos los productos") y el modo del año (AGRUPADO o DETALLADO);
  - vista previa que imita la hoja A4 horizontal (títulos, cabecera, zona del sello, saldo inicial, filas y TOTALES) con las cifras tal como llegan del JSON;
  - **Descargar PDF** (todos), **Página de prueba de márgenes** (A, C) y **Registrar impresión** (A, C; solo meses cerrados): solo observación, la fecha de hoy informativa y la oficial `impresoEn` del servidor;
  - estado del mes con `EstadoLibro121` e impresiones registradas (`GET /libros/12-1/impresiones`); con el mes abierto, un aviso explica que se imprime después de cerrarlo;
  - `PERIODO_NO_CERRADO` y conflictos se manejan dentro del diálogo.
- **Libro 13.1** (`/inventario/libros/13-1`, todos): filtros como el kardex, PDF y Excel. «Detallado» solo para A y C (D-33): para los demás ni se muestra ni se envía.
- **Reportes** (`/inventario/reportes/toneladas`, `costo-ventas`, `resumen-anual`, `margen`; todos), año en la URL y **Descargar Excel**:
  - Toneladas y Costo de ventas: un bloque por producto más "EN TONELADAS" o "RESUMEN", con la fila TOTAL y las columnas COSTO DE VENTAS, MERMAS y TOTAL SALIDAS VALORIZADAS tal como las nombra la API;
  - Resumen anual: conceptos × productos (TN y S/) con la columna TOTAL;
  - Margen: ventas TN y S/, costo de ventas, margen, % ("—" si es null) y ventas sin precio aparte, más un gráfico de barras (ventas y costo de ventas por mes, un solo eje, leyenda y tooltip con las cifras exactas).
- **Excel formato contadora** (`/inventario/reportes/excel-contadora`, A y C): selector de año y descarga.
- **Kardex**: botones «PDF 13.1» y «Excel» con los mismos filtros del kardex (Detallado solo si el rol puede).
- **Descargas**: `solicitarArchivo` en `api/cliente.ts` (mismo token, refresh y "Despertando el servidor…", `Accept: */*`, 120 s), `api/descargas.ts`, `lib/descargas.ts` (nombre de `Content-Disposition` con `filename*` y `filename`, saneado; guardado con un enlace temporal) y el común `BotonDescarga` ("Generando…", `aria-busy`; mensajes de 403, 409 `PERIODO_NO_CERRADO` y 429).
- Permisos nuevos en `lib/roles.ts`: `libros:registrar-impresion`, `libros:prueba-margenes`, `libros:13-1-detallado` y `reportes:excel-contadora` (A, C). Mensaje `SALDO_INICIAL_YA_EXISTE` en `lib/errores.ts`; `formatearFechaInstante` en `lib/formato.ts`.
- Invalidación: `invalidarTrasEscritura` incluye ahora el libro 12.1 (puede quedar desactualizado) y los reportes. Registrar impresión invalida periodos y libro 12.1.
- Documentación: `CONTRATO-API.md` §6 (tabla general), §6.4 y §6.5 (nuevo); `UI-UX.md` §4, §5.9–5.12 y §6.

**Decisiones**
- **Fecha de impresión**: el diálogo pide solo la observación y muestra la fecha de hoy como informativa. La oficial es `impresoEn` del servidor, porque `RegistrarImpresionDto` no recibe fecha. Aprobado.
- **Prueba de márgenes**: visible solo para A y C. La API no lo restringe en el OpenAPI: queda como pendiente para la API. Aprobado.
- **Resumen anual** por producto con su TOTAL (la API no lo da por mes); **13.1 sin tabla en pantalla**; **vista previa del 12.1 con las cifras tal como llegan** (sin big.js, para que coincidan con el PDF). Aprobado.
- **Gráfico de Margen sin dependencias nuevas**: recharts 3.10.1 ya estaba en el stack. Se carga solo al abrir Margen (paquete aparte de ~372 kB). Los importes se convierten a número con big.js **solo para dibujar** las barras; la tabla "TOTAL DE PRODUCTOS" es la vista accesible.
- **Colores del gráfico**: `--chart-2` y `--chart-3` se ajustaron (claro `#0891b2`; oscuro `#0b9fbd` y `#c97a44`). Los anteriores no pasaban el validador de paletas de la guía de gráficos (croma en claro, luminosidad en oscuro). Ningún otro componente usaba esos tokens.
- **Filtros de los libros**: el mismo formato de URL que el kardex (`leerFiltrosKardex`), así el 13.1 enlaza al kardex con los mismos filtros.
- **`/reportes/:reporte`**: una ruta por reporte, la del menú; cualquier otra cae en "Página no encontrada".

**Pendientes para la API (Sprint 11)**
- Verificar que `GET /libros/12-1/prueba-margenes` esté limitado a ADMIN y CONTADOR y documentarlo en el OpenAPI (con su e2e si falta).
- Documentar el 429 en el OpenAPI de las descargas de `/libros` y `/reportes`.
- Documentar el 409 `PERIODO_NO_CERRADO` en la descarga del 12.1 si la API lo devuelve.

**Pendientes (web)**
- Criterios de aceptación contra la API local en modo demostración (descargas reales, registrar impresión y tarjetas de Periodos): los prueba el equipo (ver "Cómo probar").
- El paquete inicial (`index-*.js`) sigue en ~504 kB, con la advertencia de 500 kB: revisar la división en el S13.
- Selector del periodo de trabajo en la barra superior (§3).
- Capturas `S10-*.png`, solo con la base de demostración y registradas en `docs/archivos-revisados.txt`.

**Cómo probar**
```
pnpm run lint ; pnpm test ; pnpm run build ; pnpm run revisar:datos
pnpm run dev  →  http://localhost:5173/inventario/libros/12-1   (API con pnpm run db:demo y pnpm run start:demo)
```
1. Como CONTADOR (`contadora.demo@syp.invalid`), en **Periodos** revisa en cada tarjeta los movimientos, las TN de compras y ventas y «Por producto». Sigue «Ver libro 12.1» de un mes cerrado.
2. En **Libro 12.1** elige un mes cerrado: revisa la vista previa y el modo del año, pulsa **Descargar PDF** y **Página de prueba de márgenes** (se descargan con el nombre que manda la API). **Registrar impresión** con una observación: el estado pasa a "Impreso dd/mm/aaaa", también en Periodos. Elige un mes abierto: aparece el aviso y no hay «Registrar impresión».
3. Registra o edita un comprobante de ese mes después de reabrirlo y volver a cerrarlo: el libro pasa a "⚠ Impresión desactualizada: vuelve a imprimir".
4. En **Libro 13.1** descarga PDF y Excel, con y sin «Detallado». En **Kardex** usa «PDF 13.1» y «Excel».
5. Abre **Toneladas**, **Costo de ventas**, **Resumen anual** y **Margen** (con el gráfico) y descarga el Excel de cada uno. En **Excel contadora** descarga el del año.
6. En **Saldos iniciales** revisa la columna C.U. y crea un **Nuevo saldo manual** para un producto sin saldo en el año.
7. Como `asistente.demo@syp.invalid` o `consulta.demo@syp.invalid`: no aparecen «Registrar impresión», la prueba de márgenes, «Detallado» ni Excel contadora (el menú tampoco lo muestra).
8. Pulsa varias descargas seguidas hasta pasar el límite por minuto: "Llegaste al límite de descargas por minuto. Espera un momento y vuelve a intentarlo."

**Números**: 297 pruebas en 34 archivos (+42 y +5 archivos):
- nuevos: `lib/descargas` 7, `BotonDescarga` 6, `pagina-libro-12-1` 10, `pagina-libro-13-1` 3 y `pagina-reporte` 8 (incluye Excel contadora);
- ampliados: `pagina-periodos` +1 (15), `pagina-saldos-iniciales` +3 (7), `pagina-kardex` +1 (14), `cliente` +2 (24) y `roles` +1 (10).

**Revisión `revisor-ux`**: APROBADO CON OBSERVACIONES, sin hallazgos altos ni datos reales. Se corrigieron las 5 de severidad media:
- WCAG 2.5.3 (la etiqueta visible está en el nombre accesible): los botones de descarga del 13.1, de los reportes, del Excel contadora y del kardex empiezan su nombre accesible con el texto visible ("Descargar PDF del libro 13.1 de …", "Descargar Excel de Toneladas 2026", "PDF 13.1 de FIERRO, …").
- `BotonDescarga`: mientras genera, el nombre accesible también dice "Generando… …" y el botón se ve bloqueado (`aria-disabled:opacity-60` y cursor de espera).
- Gráfico de Margen: el texto de la leyenda va en color de texto (solo el ícono lleva el color de la serie) y `accessibilityLayer={false}`, para que el svg oculto no reciba foco.
- Libro 12.1: si falla la consulta de periodos o de impresiones, un aviso "No pudimos leer el estado del mes" con «Reintentar» (antes «Registrar impresión» desaparecía en silencio).

También se corrigieron 6 de severidad baja:
- `docs/UI-UX.md` §2 con los valores nuevos de `--chart-2` y `--chart-3` (y la nota de que `--chart-2` claro no sirve para texto);
- "Ver libro 12.1 de {mes}" como nombre accesible del enlace de la tarjeta;
- registrar impresión invalida también el dashboard (S12);
- «Nuevo saldo manual» se deshabilita, con una ayuda visible, si todos los productos ya tienen saldo; tras `SALDO_INICIAL_YA_EXISTE` se limpia el producto para no reenviarlo;
- vista previa del 12.1 a 12 px (`text-xs`);
- "—" del MARGEN % se lee "sin ventas con precio".

Quedan dos de severidad baja, opcionales:
- distinguir las dos series del gráfico con algo más que el tono (cian y naranja ya son distinguibles para daltónicos, y la tabla y el tooltip lo compensan);
- llevar los costos de `src/pruebas/libros-demo.ts` a montos más redondos (ya son ficticios y pasan `revisar:datos`).

**Correcciones de la prueba manual (15/11/2026)**
- **Margen sin ventas con valor de venta**: si ningún mes del año tiene "ventas S/" mayores que 0 (o el año no tiene meses), en lugar del gráfico vacío aparece el aviso "En {año} no hay ventas con valor de venta registrado, por eso no se puede calcular el margen. Ventas sin precio: {TN} TN (costo S/ {monto})." Las cifras salen del total del año que manda la API (`total.total.sinPrecio`; `0.0000 TN` y `S/ 0.00` si no hay meses). La tabla por producto se mantiene.
  - `sinVentasConPrecio(meses)` vive en `reportes/margen.ts` (sin recharts). La decisión entre aviso y gráfico la toma `GraficoMargen`: así recharts sigue cargándose solo al abrir Margen y el lint no advierte `only-export-components`. big.js solo compara con cero.
- **Avisos al volver a cerrar un mes**: los totales que cambiaron se nombran en español (saldo inicial TN/S/, compras TN/S/, otras entradas, ventas TN, costo de ventas S/, mermas, desmedros, otras salidas, saldo final TN/S/). Se traduce el campo estructurado `diferenciasConCierreAnterior[].campo` con `nombreCampoCierre` (`periodos/utilidades.ts`); no se analiza texto. Un campo desconocido se muestra tal cual.
- `esquema.d.ts` verificado idéntico a lo que genera `pnpm run api:tipos` al cerrar el sprint.

**Números al cierre**: 303 pruebas en 35 archivos (+6 y +1 archivo: `grafico-margen` 4 nuevo; `pagina-periodos` +2). Lint sin errores (6 advertencias previas, de shadcn y del kardex), build correcto, `revisar:datos` SIN DATOS REALES y Hooks OK.

**Cómo probar las correcciones**
1. En **Margen** (`/inventario/reportes/margen?anio=<año>`) elige un año sin ventas con precio: aparece el aviso con las TN y el costo de las ventas sin precio, sin gráfico, y la tabla sigue. Con un año con ventas con precio, el gráfico se ve como antes.
2. En **Periodos**, como `contadora.demo@syp.invalid`, reabre el último mes cerrado, registra un cambio y vuelve a cerrarlo: el aviso dice, por ejemplo, "(compras TN, compras S/, saldo final TN, saldo final S/)".

### S11 — contabilidad-control (21/11/2026)

Rama `sprint/11-contabilidad-control`. Tipos regenerados con `pnpm run api:tipos` desde `../inventario-syp-api/docs/openapi.json` del S11 de la API (+1102 / −29 líneas en `src/api/esquema.d.ts`):
- 9 rutas nuevas: `GET /asientos`, `GET /asientos/exportados`, `POST /asientos/winconta`, `GET /control-tonelaje`, `PUT /control-tonelaje/{anio}/{mes}`, `GET`/`POST /tomas-inventario`, `GET /tomas-inventario/{id}` y `POST /tomas-inventario/{id}/resolver` y `/cerrar`.
- Esquemas nuevos de asientos, control de tonelaje y tomas.
- Cambios en esquemas existentes:
  - `PeriodoDto.asiento.estado` ahora es `SIN_ASIENTO | PENDIENTE | EXPORTADO | DESACTUALIZADO`;
  - `Libro121Dto.borrador` y, en cada bloque, `estadoMes` y `borrador`;
  - las descargas de `/reportes` documentan el 429.

**Qué se hizo**
- **Asientos y WinConta** (`/inventario/asientos?anio&mes&grupo`, todos; exportar A y C):
  - pestañas Costo de ventas, Mermas, Desmedros y Ajustes (este último con faltante y sobrante);
  - por tipo: glosa, comprobante, estado de la exportación y tabla Cuenta · Debe · Haber, con el importe exacto en tooltip (también con el teclado) y los totales con "✓ Cuadra";
  - desplegable «Reglas aplicadas»;
  - aviso "Falta regla contable" con la lista de movimientos sin regla y el enlace a Reglas contables (⚠ también en la pestaña). Solo bloquea la exportación de ese tipo;
  - si `exportable` es false, el motivo que manda la API (mes abierto = vista previa, falta regla, sin líneas).
  - **Exportar a WinConta**: diálogo con N.° de asiento (exactamente 4 dígitos) y tipo de cambio (> 0, hasta 3 decimales), validados con zod en español. Descarga el `.xlsx` con el manejo de descargas del S10 (`descargarArchivoPost` → `solicitarArchivo` con POST). Mensajes propios para 409 `PERIODO_NO_CERRADO`, 422 `REGLA_CONTABLE_FALTANTE` y `ASIENTO_VACIO` (estos tres además recargan los asientos), 429, 400 `VALIDACION` (marca el campo) y `CONFLICTO_CONCURRENTE` (`AvisoConflicto`).
  - **Historial de exportaciones del año**: ✓ Vigente · ⚠ Desactualizado: vuelve a exportar · Reemplazada (ícono + texto).
- **Control de tonelaje** (`/inventario/control-tonelaje?anio`, todos; editar A y C):
  - tabla de 12 meses (Mes · Toneladas reportadas · Fuente · Compras del kardex · Diferencia · Observación), una fila por reporte;
  - las diferencias con fondo `warning` suave, ícono, el texto "Diferencia" y la cifra, más un aviso con los meses con diferencia;
  - diálogo **Editar / Registrar**: toneladas con 4 decimales, fuente "REPORTE EXTERNO" por defecto (fija al editar un reporte existente) y observación;
  - **Descargar Excel**.
- **Toma de inventario** (`/inventario/toma-inventario`, `/nueva` y `/:id`):
  - **Lista** por año: fecha, responsable, productos con diferencia, estado, comprobantes (enlaces) y Resolver/Cerrar/Ver. Una toma en BORRADOR con otra posterior de la misma fecha se marca "Reemplazada por la toma del <fecha y hora>" (ícono + texto) y no se ofrece resolverla.
  - **Nueva toma** (A, C), pasos 1–2: fecha (aviso y bloqueo si el mes está cerrado), responsable, observación y la cantidad contada de cada producto activo. Indicador de pasos y foco en el título de cada paso. 409 `PERIODO_CERRADO` → vuelve al paso 1 con el mensaje en la Fecha.
  - **Detalle**:
    - paso 3: sistema, contado, diferencia y tipo (Faltante / Sobrante / Sin diferencia, "Dentro de la tolerancia");
    - paso 4 (A, C): Merma (solo faltantes; sustento y año del informe), Ajuste (sustento del acta) o Ninguna (observación), validados con zod → «Resolver diferencias»;
    - luego «Cerrar toma» con confirmación;
    - enlaces a los comprobantes de merma y ajuste generados.
  - Errores: `DialogoStockNegativo` del S8 con reenvío confirmado. `TOMA_DESACTUALIZADA` → aviso con **Volver a calcular** (crea una toma nueva con la misma fecha, establecimiento, responsable, observación y cantidades, y la abre). Mensajes para `TOMA_CON_DIFERENCIAS_PENDIENTES`, `TOMA_YA_RESUELTA`, `TOMA_YA_CERRADA`, `ACCION_NO_CORRESPONDE`, `OBSERVACION_REQUERIDA` y `PERIODO_CERRADO`.
- **Libro 12.1**: si el JSON trae `borrador`, junto a «Descargar PDF» aparece "El PDF saldrá con la marca BORRADOR: no lo imprimas en las hojas legalizadas hasta cerrar el mes." y cada bloque de la vista previa lleva la franja BORRADOR, como el PDF.
- **Periodos**: el asiento del mes es real (`EstadoAsiento`, nuevo común: Sin asiento · Pendiente · ✓ Exportado · ⚠ Desactualizado), mostrado igual que el del libro 12.1, con el enlace «Ver asientos» a `/inventario/asientos?anio&mes`.
- Permisos (`lib/roles.ts`): `asientos:exportar`, `tonelaje:editar` y `tomas:gestionar` (A, C).
- Mensajes (`lib/errores.ts`): `ASIENTO_VACIO`, `TOMA_DESACTUALIZADA`, `TOMA_CON_DIFERENCIAS_PENDIENTES`, `TOMA_YA_CERRADA`, `TOMA_YA_RESUELTA`, `ACCION_NO_CORRESPONDE` y `OBSERVACION_REQUERIDA`.
- `invalidarTrasEscritura` incluye asientos, control de tonelaje y tomas.
- Documentación: `CONTRATO-API.md` §6 (tabla), §6.4, §6.5 y §6.6 (nuevo); `UI-UX.md` §3, §4, §5.9, §5.11, §5.13–5.15 y §6.

**Decisiones** (aprobadas por el equipo antes de implementar)
- **«Volver a calcular»** crea una toma nueva con los mismos datos, porque la API no tiene un endpoint para recalcular ni anular una toma. La anterior queda en BORRADOR y la lista la marca "Reemplazada por la toma del <fecha y hora>".
  - Se considera "posterior" la que tiene un `creadoEn` mayor, la misma fecha y el mismo establecimiento.
  - El detalle de una toma reemplazada enlaza a la vigente y no deja resolverla.
- **Control de tonelaje**: el PUT exige las toneladas, así que el diálogo siempre las pide. La fuente es fija al editar, porque la API reemplaza el reporte de esa fuente. Una observación vacía no se envía.
- **Líneas del asiento**: Cuenta · Debe · Haber (`LineaAsientoDto` no trae descripción) más el desplegable «Reglas aplicadas». Se muestran los importes `redondeado` (lo que se exporta) y el `exacto` en tooltip. "Cuadra" solo compara `totalDebe` y `totalHaber` con big.js; no suma nada.
- **Descarga con POST**: `solicitarArchivo` acepta `metodo` y `cuerpo`. Como escritura, ante un 504 no se repite sola (`SIN_RESPUESTA`).
- **Toma**: los pasos 1–2 son una página (`/nueva`) y los pasos 3–4, el detalle (`/:id`). Así una toma registrada se puede retomar desde la lista sin perder nada.

**Pendientes para la API (Sprint 12)**
- Endpoint para **anular o recalcular una toma en BORRADOR**, para que no queden tomas sueltas al «Volver a calcular».
- (Siguen del S10) Verificar y documentar el rol de `GET /libros/12-1/prueba-margenes` y el 409 `PERIODO_NO_CERRADO` de la descarga del 12.1.

**Pendientes (web)**
- Criterios de aceptación contra la API local con la base demo (exportar WinConta con mes cerrado, editar el tonelaje y una toma completa): los prueba el equipo (ver "Cómo probar").
- El paquete inicial (`index-*.js`) sigue en ~506 kB, con la advertencia de 500 kB: revisar la división en el S13.
- Capturas `S11-*.png`, solo con la base de demostración y registradas en `docs/archivos-revisados.txt`.
- Prueba inestable por tiempo: en el cierre, `encabezado.test.tsx` ("muestra el estado del mes en curso…") falló una vez porque la batería tardó 56 s en vez de ~30 s y su `findByRole` espera 1 s. Pasa sola y en la batería repetida (370/370). En el S13, darle más espera o revisar la carga de la PC en el CI.

**Cómo probar**
```
pnpm run lint ; pnpm test ; pnpm run build ; pnpm run revisar:datos
pnpm run dev  →  http://localhost:5173/inventario/asientos   (API con pnpm run db:demo y pnpm run start:demo)
```
1. Como CONTADOR (`contadora.demo@syp.invalid`), en **Periodos** cierra un mes con movimientos. La tarjeta muestra "Asiento: Pendiente" y «Ver asientos» lleva a ese mes.
2. En **Asientos**:
   - revisa cada pestaña: tabla Debe/Haber, totales, «Reglas aplicadas» y, si un tipo no tiene regla, el aviso "Falta regla contable" con su exportación bloqueada;
   - **Exportar a WinConta** con `12` y `0`: aparecen los errores en español;
   - con `0001` y `3.750` se descarga el `.xlsx` y aparece en el historial como ✓ Vigente;
   - en un mes abierto, el botón está deshabilitado con el motivo.
3. Reabre ese mes, registra un cambio y vuelve a cerrarlo: el historial y Periodos muestran ⚠ Desactualizado.
4. En **Control de tonelaje** edita las toneladas de un mes: la diferencia y su marca "Diferencia" se recalculan. Registra un mes sin reporte y descarga el Excel.
5. En **Toma de inventario** → **Nueva toma**:
   - fecha de un mes abierto y responsable;
   - pesa cada producto con cantidades distintas al saldo y pulsa «Calcular diferencias»;
   - en el detalle elige Merma para un faltante y Ajuste o Ninguna para el resto, resuelve y luego «Cerrar toma»;
   - los enlaces llevan a la merma `00-IT-<año>` y al ajuste `00-AI-…`.
6. Crea otra toma, registra después una compra con fecha anterior a la toma y pulsa «Resolver diferencias»: aparece "El kardex cambió…" con «Volver a calcular». La lista marca la anterior como "Reemplazada por la toma del …".
7. En **Libro 12.1**, con un mes abierto, aparece el aviso de la marca BORRADOR junto a «Descargar PDF».
8. Como `asistente.demo@syp.invalid` o `consulta.demo@syp.invalid` no aparecen «Exportar a WinConta», «Editar/Registrar» del tonelaje, «Nueva toma» ni el paso 4.

**Revisión `revisor-ux`**: APROBADO CON OBSERVACIONES, sin hallazgos altos ni datos reales (`0015` y `3.355` no aparecen en el repo; contraste de `bg-warning/10` AA en ambos temas). Se corrigieron las 3 de severidad media:
- Control de tonelaje: el `th` del mes con `rowSpan` pasa de `scope="rowgroup"` a `scope="row"`, porque con un solo `<tbody>` el lector anunciaba "Enero" en las filas de los meses siguientes.
- Paso 4 de la toma: en un sobrante el radio Merma ya no se muestra (queda la nota "La merma (13) solo corresponde a faltantes."). Así, el foco del error cae en un radio habilitado. El error se asocia también al `radiogroup`.
- Al resolver, el foco pasa al título del paso 4, donde ahora está «Cerrar toma». Antes caía en `<body>` porque el formulario se desmonta.

También se corrigieron 7 de severidad baja:
- historial ordenado por AAAA-MM (no alfabéticamente);
- importe exacto de «Reglas aplicadas» en tooltip accesible con el teclado (antes solo `title`) y el exacto con miles;
- `Ctrl+Enter` en Nueva toma (paso 1 avanza, paso 2 calcula);
- foco en la Fecha tras un `PERIODO_CERRADO` de la API;
- cabeceras "Toneladas reportadas (TN)" y "Diferencia (reportado − kardex, TN)";
- aviso BORRADOR sin el texto repetido;
- "Faltante de 0.2500 TN" sin doble negativo.
- Además, «Volver a calcular» invalida también el dashboard.

Bajas pendientes:
- Pestaña de Asientos vacía sin acción (enlace a Kardex o Periodos).
- Columna "Detalle" del boceto §5.13: `LineaAsientoDto` no trae descripción. Se pedirá el nombre de la cuenta a la API si la contadora lo necesita.

**Números**: 370 pruebas en 41 archivos (+67 y +6 archivos):
- nuevos: `asientos/esquemas` 10, `pagina-asientos` 16, `pagina-control-tonelaje` 8, `pagina-tomas` 7, `pagina-nueva-toma` 5 y `pagina-detalle-toma` 15;
- ampliados: `pagina-libro-12-1` +2, `pagina-periodos` +1, `cliente` +1, `roles` +1 y `errores` +1.

Lint sin errores (las mismas 6 advertencias previas, de shadcn y TablaDatos), build correcto y `revisar:datos` SIN DATOS REALES.
