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
| S9 Kardex y periodos (WEB) | pendiente | `sprint/09-kardex-periodos` | |
| S10 Libros y reportes (WEB) | pendiente | `sprint/10-libros-reportes` | |
| S11 Contabilidad y control (WEB) | pendiente | `sprint/11-contabilidad-control` | |
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
