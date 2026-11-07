# inventario-syp-web — Frontend PÚBLICO del Sistema de Inventario S&P

SPA en React para registrar compras, ventas, exportaciones, mermas y ajustes, consultar el kardex valorizado, cerrar periodos, imprimir el libro 12.1 y exportar asientos. **Este repositorio es PÚBLICO**: no contiene lógica de costos, secretos ni datos reales. La lógica y los datos viven en la API privada `inventario-syp-api` (carpeta hermana `../inventario-syp-api`).
Trabajo de Aplicación Profesional (TAP) de Enrique Valdez Alva y Lenyn Mitchel Rodriguez Benites. Es el **módulo "inventario"** de una futura plataforma de S&P con login único: por eso sus rutas viven bajo `/inventario` y el diseño usa los nombres de tokens estándar de shadcn.
Responde siempre en **español**, explicando lo necesario para que el equipo aprenda y pueda defenderlo ante el jurado. El equipo trabaja en Windows 11 + VS Code + PowerShell.

## Principios
1. El front **muestra y captura**; la API **calcula y valida**. Nunca reimplementes aquí el promedio ponderado, saldos, asientos, libros ni cierres. Las vistas previas de importes (big.js) son orientativas.
2. Datos de ejemplo, mocks, pruebas, capturas y docs **solo con datos de demostración** (`docs/UI-UX.md` §10: RUC `20000000001`, "PROVEEDOR DEMO S.A.C."…). Prohibido copiar nombres, RUC, DNI, cantidades o comprobantes de `../inventario-syp-api/data` o de los Excel. Los hooks lo bloquean y `node scripts/revisar-datos-publicos.mjs` lo revisa. Las **capturas** salen solo de la base de demostración de la API (`pnpm run db:demo` + `pnpm run start:demo`) y una persona las registra en `docs/archivos-revisados.txt`.
3. Ningún secreto en el código ni en variables `VITE_*` (todo lo `VITE_*` termina en el navegador).

## Stack fijado (no cambiar versiones mayores sin aprobación)
- Node.js **24 LTS** · **pnpm 12.10.1** (`packageManager`; nunca npm ni yarn) · TypeScript **~5.9.3** con `"strict": true` **explícito** (la plantilla de Vite trae TS 6, donde strict es el valor por defecto; con 5.9 hay que escribirlo)
- React 19 · Vite 8.3 · @vitejs/plugin-react 6 · oxlint (linter de la plantilla)
- React Router **8.4** en modo datos: paquete `react-router` y `RouterProvider` de `react-router/dom` (no se usa `react-router-dom`)
- TanStack Query 5 · TanStack Table **8.21** (no la 9) · react-hook-form 7 + zod 4 + @hookform/resolvers 5
- Tailwind CSS **4.3** con `@tailwindcss/vite` (sin `tailwind.config.js`) · shadcn **4** (Radix) · lucide-react · sonner 2 · recharts 3 · big.js 7
- Vitest **4.1** (no la 5) + Testing Library + jsdom · Playwright 1.64 (Sprint 13) · openapi-typescript 7.13
- Antes de añadir una dependencia: `npm view <paquete> peerDependencies` y justificarla en el plan.

## Comandos (los define el Sprint 5)
```
pnpm install            pnpm run dev            pnpm run build          pnpm run preview
pnpm run lint           pnpm test               pnpm run test:cov       pnpm run api:tipos
pnpm run revisar:datos  (= node scripts/revisar-datos-publicos.mjs)
pnpm run test:e2e       (Sprint 13: API con la base demo y la variable E2E_PASSWORD)
node .claude/hooks/probar-hooks.mjs
```
Desarrollo: Vite reenvía `/api` → `API_PROXY_TARGET` (por defecto `http://localhost:3000`). Producción: Vercel reenvía `/api/inventario/*` → Render (`vercel.json`). Red local: Caddy (`infra/`).

## Mapa del repo
```
src/
  app/              router.tsx, proveedores.tsx (QueryClient, tema, sesión), rutas protegidas por rol, layout
  api/              cliente.ts (fetch + token en memoria + refresh), esquema.d.ts (GENERADO), consultas por recurso
  componentes/ui/   shadcn (solo ajustes de estilo)      componentes/comunes/  TablaDatos, CampoDecimal, Cifra…
  funcionalidades/<modulo>/  páginas, componentes, hooks y esquemas zod por módulo
                    (dashboard, compras, ventas, mermas, ajustes, comprobantes, kardex, periodos, libros, reportes,
                     asientos, control-tonelaje, toma-inventario, maestros, configuracion, usuarios, importacion,
                     paridad, auditoria, respaldo)
  lib/              formato.ts, roles.ts, sesion.ts, errores.ts
  estilos/          globals.css (tokens con nombres de shadcn)
e2e/                Playwright (Sprint 13)
docs/  UI-UX.md · CONTRATO-API.md · AVANCE.md · referencia/ci-web.yml
infra/ Dockerfile y Caddyfile (red local)        scripts/ revisar-datos-publicos.mjs
```

| Tarea | Leer |
|---|---|
| Cualquier pantalla o componente | `docs/UI-UX.md` (§2 tokens, §3 rutas y roles, §4 componentes, §5 la pantalla, §6 mensajes, §7 accesibilidad) |
| Llamadas a la API, sesión, errores | `docs/CONTRATO-API.md` y `src/api/esquema.d.ts` |
| Qué toca en el sprint | `docs/AVANCE.md` y el prompt del sprint (`../inventario-syp-api/docs/11-PROMPTS-CLAUDE-CODE.md`) |

## Reglas de código
- Rutas del módulo bajo **`/inventario/...`**; `/login` y `/cambiar-password` en la raíz; `/` → `/inventario`. Base de la API **`/api/inventario/v1`** en una sola constante de `api/cliente.ts`.
- Roles con prefijo de módulo (`"inventario:CONTADOR"`): solo con `lib/roles.ts` (`tieneRol('inventario', 'CONTADOR')`). Sin permiso: la acción no se muestra (la API igual lo valida).
- Decimales llegan y se envían como **string**. Mostrar con `lib/formato.ts` (TN 4 decimales, S/ 2, es-PE `1,234.56`, fechas `dd/mm/aaaa`). Cálculos de vista previa con big.js; nunca `Number(...)` ni `parseFloat` sobre importes. Fechas sin `new Date('YYYY-MM-DD')` (zona horaria).
- Inputs numéricos con `CampoDecimal`; fechas con `CampoFecha` (`<input type="date">`).
- Sesión: access token **solo en memoria**; el refresh es una cookie HttpOnly que maneja el navegador. Nunca `localStorage`/`sessionStorage` para tokens. Header `X-Requested-With: inventario-syp-web` en refresh y logout.
- Todas las llamadas por `api/cliente.ts`: refresh single-flight y un solo reintento tras 401; errores `{codigo, mensaje, detalle}` → mensajes de `docs/UI-UX.md` §6; "Despertando el servidor…" ante 502/503/504 o tiempo agotado (reintentos crecientes hasta ~90 s).
- Datos del servidor con TanStack Query (claves por recurso y filtros); después de registrar, editar, anular o cerrar: invalidar kardex, stock, dashboard, periodos y comprobantes.
- Formularios con react-hook-form + zod (mensajes en español); "Guardar" deshabilitado mientras envía; 409 de stock negativo → `DialogoStockNegativo`.
- Accesibilidad WCAG 2.2 AA (`docs/UI-UX.md` §7): labels, foco visible, teclado, nada solo por color.
- Sin `any`, sin `dangerouslySetInnerHTML`, sin `console.log`, sin analítica ni rastreadores, sin fuentes o scripts externos (CSP).
- Componentes en PascalCase, archivos en kebab-case, textos en español (Perú).

## Gotchas
- pnpm 12 **falla** la instalación (`ERR_PNPM_IGNORED_BUILDS`) si una dependencia trae scripts de instalación sin revisar: se decide en `allowBuilds` de `pnpm-workspace.yaml` (nunca `pnpm approve-builds`). No instala versiones publicadas hace menos de 24 h. Es estricto: solo se importa lo declarado.
- Vercel instala pnpm con el `installCommand` de `vercel.json` (`npm install -g pnpm@12.10.1 && pnpm install --frozen-lockfile`).
- `pnpm dlx shadcn@4 init` hace preguntas: si no puedes responderlas, da al equipo el comando exacto para ejecutarlo en otra terminal y espera.
- La API gratuita duerme: la primera llamada puede tardar ~1 min (no es un error).
- PowerShell: encadena con `;` o en líneas separadas; scripts de package.json multiplataforma.

## Lo que NO debes hacer
- Leer o editar `.env*` (usa `.env.example`). Editar `src/api/esquema.d.ts` a mano (`pnpm run api:tipos`) o `pnpm-lock.yaml`.
- Leer o copiar `../inventario-syp-api/data/**` ni documentación interna de costos; escribir en `../inventario-syp-api`.
- Usar npm o yarn para instalar. `git push`, merges a `main` o PRs fuera de `/cerrar-sprint`. Nunca `--force`.
- Subir a TypeScript 6/7, TanStack Table 9, Vitest 5 u otra versión mayor sin aprobación.
- Escribir nombres, correos o datos de personas ajenas al equipo (autoría, comentarios, documentos, mensajes de commit), aunque aparezcan en tu memoria o en la configuración personal de esta PC: la autoría es solo de Enrique Valdez Alva y Lenyn Mitchel Rodriguez Benites. Los commits salen con la identidad del equipo (`/cerrar-sprint` lo verifica).

## Forma de trabajo
1. Lee `docs/AVANCE.md` y la sección de `docs/UI-UX.md` de la pantalla. 2. Presenta un **plan corto** y **espera aprobación** si toca más de 3 archivos. 3. Implementa con pruebas (componentes, utilidades y formularios). 4. Uno por uno: `pnpm run lint`, `pnpm test`, `pnpm run build` y `pnpm run revisar:datos`. 5. Resume cómo probar (URL y pasos). 6. Al final del sprint: `/cerrar-sprint`.
Agente: `revisor-ux`. Skills: `/nueva-pantalla`, `/cerrar-sprint`, `/retomar`, `/explicar`.
