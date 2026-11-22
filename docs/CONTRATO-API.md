# Contrato con la API (resumen para el frontend)

La API (`inventario-syp-api`) es **privada**; este documento resume lo que el frontend necesita. La fuente exacta es el **OpenAPI** que la API genera con `pnpm run openapi` en `../inventario-syp-api/docs/openapi.json`. De ahí salen los tipos de este repo:

```powershell
pnpm run api:tipos     # openapi-typescript ../inventario-syp-api/docs/openapi.json -o src/api/esquema.d.ts
```

- `src/api/esquema.d.ts` es **generado**: no se edita a mano (lo bloquean los hooks). Se regenera al empezar la parte WEB de cada sprint.
- Si un tipo no existe todavía, se pide primero en la API (otro repo) y luego se regenera. No se "inventan" campos en el front.

## 1. Base y entornos

| Entorno | El navegador llama a | Quién reenvía a la API |
|---|---|---|
| Desarrollo | `http://localhost:5173/api/inventario/v1/...` | proxy de Vite → `API_PROXY_TARGET` (por defecto `http://localhost:3000`) |
| Nube | `https://<dominio-vercel>/api/inventario/v1/...` | reescritura de `vercel.json` → Render |
| Red local | `https://<IP-del-servidor>/api/inventario/v1/...` | Caddy (`infra/Caddyfile`) → contenedor `api` |

La base **`/api/inventario/v1`** vive en una sola constante de `src/api/cliente.ts`. Siempre el mismo origen: la cookie de sesión funciona sin CORS.

## 2. Convenciones

- JSON en camelCase. **Decimales como string** (`"12.5000"`, `"3480.0000000000"`): nunca se convierten a `number` para calcular; se formatean con `lib/formato.ts` y se envían como string.
- Fechas de negocio `YYYY-MM-DD` (se muestran `dd/mm/aaaa`).
- Listados: `?pagina=1&tamano=50` → `{ datos: [...], total, pagina, tamano }`.
- Errores: `{ codigo, mensaje, detalle? }` (mensajes de pantalla en `docs/UI-UX.md` §6). Validación: 400 `VALIDACION` con `detalle.campos`.
- Todas las respuestas traen `Cache-Control: no-store`.
- Archivos (`formato=pdf|xlsx`, respaldos): respuesta binaria con `Content-Disposition: attachment; filename="…"`; se descargan como blob con `BotonDescarga`.
- Escrituras que afectan el kardex aceptan `confirmarStockNegativo: true` (ver §5).

## 3. Sesión

```
POST /auth/login {email, password}
  → 200 { accessToken, usuario: { id, email, nombre, roles: ["inventario:CONTADOR"], debeCambiarPassword } }
  + cookie de refresh HttpOnly (Path=/api/inventario/v1/auth): el front no la ve ni la toca
Cada petición: Authorization: Bearer <accessToken>        (el token vive SOLO en memoria)
401 → POST /auth/refresh  (cookie + header X-Requested-With: inventario-syp-web)
      → nuevo accessToken → se repite UNA vez la petición original
      si el refresh falla → limpiar sesión → /login
POST /auth/logout (con el mismo header) → borra la cookie
```

- **Single-flight**: si varias peticiones reciben 401 a la vez, se hace **un solo** refresh y todas esperan su resultado.
- **Sin refresh automático** para `/auth/login` ni `/auth/refresh`: un 401 ahí se muestra o lleva a `/login` (si no, se crearía un bucle). Tampoco se refresca un 401 `CREDENCIALES_INVALIDAS` en otra ruta (p. ej. contraseña actual incorrecta en `/auth/cambiar-password`): no es un token vencido.
- Login fallido: 401 `CREDENCIALES_INVALIDAS` (mismo mensaje para contraseña incorrecta y cuenta bloqueada); demasiados intentos: 429 `DEMASIADAS_SOLICITUDES`.
- Al cargar la app primero se despierta la API con `GET /salud` y luego se intenta un refresh silencioso para recuperar la sesión (si hay cookie válida).
- Nunca `localStorage` ni `sessionStorage` para tokens.
- Roles con prefijo de módulo: se consultan solo con `lib/roles.ts` → `tieneRol('inventario', 'CONTADOR')`.
- Access token de 15 min; sesión (refresh) de 12 h **desde el login** (el refresh rotado hereda el vencimiento); 5 intentos fallidos bloquean 15 min (la respuesta sigue siendo `CREDENCIALES_INVALIDAS`).
- Si el refresh responde 429 o 5xx, la sesión **no** se cierra (la API no usó la cookie); solo 401/403 la cierran.

### 3.1 Cambio de contraseña obligatorio (pendiente del S4 de la API)

- Si `usuario.debeCambiarPassword` es `true` (primer ingreso o contraseña restablecida), el usuario solo puede usar `/auth/me`, `/auth/cambiar-password` y `/auth/logout`. El resto responde **403 `CAMBIO_PASSWORD_REQUERIDO`**.
- Es 403 y **no** 401 a propósito: el cliente **no intenta refresh ni reintento**; marca la sesión con `debeCambiarPassword: true` y navega a **`/cambiar-password`**. `RutaProtegida` no deja entrar a ninguna página del módulo hasta cambiarla.
- `POST /auth/cambiar-password {actual, nueva}` (nueva: 12 a 200 caracteres) responde **200 con una sesión nueva** (`{accessToken, usuario}`) y revoca las anteriores.

### 3.2 Un solo refresh a la vez, también entre pestañas (pendiente del S4 de la API)

La cookie de refresh es **una sola para todas las pestañas** y la API la **rota** en cada uso. Si dos pestañas envían a la vez la **misma** cookie, la API lo toma como reutilización (`REFRESH_REUTILIZADO`), revoca la familia y **cierra la sesión**. Por eso (`src/api/coordinacion-pestanas.ts`):

1. Dentro de la pestaña: *single-flight* (una sola promesa de refresh compartida).
2. Entre pestañas: un candado. Se usa **`navigator.locks`** (Web Locks API, nombre `inventario-syp:refresh`). Si no existe, un **candado de respaldo con `BroadcastChannel`** (`inventario-syp:sesion`): la pestaña anuncia `refresh-iniciado` con un id aleatorio, espera 50 ms para detectar empates (gana el id menor) y avisa `refresh-terminado` al acabar; el candado de una pestaña que se cerró a medias vence a los 30 s. Si tampoco hay `BroadcastChannel`, solo queda el single-flight de la pestaña.
3. La pestaña que esperaba, al obtener el candado, hace **su propio** refresh con la cookie **ya rotada**: es secuencial, no reutilización.
4. **El access token nunca viaja entre pestañas.** Cada una guarda solo el suyo en memoria. Por el canal solo pasan avisos sin secretos: `refresh-terminado`, `logout` (cierra la sesión en todas las pestañas) y, solo en el candado de respaldo, `refresh-iniciado` con el id aleatorio. Una prueba (`cliente.test.ts`) verifica que ningún mensaje contiene el token ni datos del usuario.
5. El refresh **no** se repite ante 504 o tiempo agotado (si la API lo hubiera procesado, repetirlo con la cookie vieja sería reutilización); sí ante 502/503.

## 4. Servidor dormido (plan gratuito)

Render duerme la API tras 15 min sin uso; despertar tarda ~1 min. Ante **502, 503, 504 o tiempo agotado** (30 s por intento) el cliente reintenta con esperas crecientes (2, 4, 8, 16, 32 s) hasta ~90 s mostrando `BannerServidor`. `GET /salud` no toca la base y sirve para despertar; `GET /salud/bd` despierta también la base (Neon).

- **502/503** (la API no recibió la petición): se reintenta cualquier método.
- **504 o tiempo agotado** (la API quizá la procesó): solo se reintentan los GET y el login. Una escritura no se repite (podría duplicar un comprobante): se muestra "El servidor no respondió a tiempo. Si estabas guardando algo, revisa si se registró antes de repetirlo." (`SIN_RESPUESTA`, código propio del cliente).

## 5. Stock negativo

Si una venta, merma o ajuste deja saldo negativo, la API responde **409**:
```json
{ "codigo": "STOCK_NEGATIVO_REQUIERE_CONFIRMACION", "mensaje": "…",
  "detalle": { "productoId": 1, "fecha": "2026-03-20", "saldoResultante": "-5.0000", "disponibleAntes": "40.0000" } }
```
El front muestra `DialogoStockNegativo` y, si el usuario confirma, **reenvía la misma petición** con `"confirmarStockNegativo": true`. Con la política `BLOQUEAR` la respuesta es 409 `STOCK_INSUFICIENTE` (sin opción de confirmar).

## 6. Endpoints

Roles: **A** ADMIN · **C** CONTADOR · **S** ASISTENTE · **Q** CONSULTA · "todos" = cualquier usuario autenticado.

| Método | Ruta | Roles | Pantalla |
|---|---|---|---|
| GET | `/salud` (`{estado, version, hora, demo}`), `/salud/bd` | público | cliente (despertar) y etiqueta de demostración |
| GET | `/catalogos` | todos (**requiere token desde el S4**; sin token, 401) | selects de Tablas SUNAT 2, 5, 6, 10, 12, 14 |
| POST | `/auth/login` (`{email, password}`, solo JSON) | público | Iniciar sesión → `{accessToken, usuario}` + cookie |
| POST | `/auth/refresh` (cookie + `X-Requested-With`) | público | cliente → `{accessToken, usuario}` + cookie rotada |
| POST | `/auth/logout` (`X-Requested-With`) | autenticado | menú de usuario → 204, borra la cookie |
| GET | `/auth/me` | todos (también con cambio pendiente) | menú de usuario → `usuario` |
| POST | `/auth/cambiar-password` (`{actual, nueva}`) | todos (también con cambio pendiente) | Cambiar contraseña → sesión nueva |
| GET | `/auth/jwks` | público | futuro login central (la web no lo usa) |
| GET / POST | `/usuarios` (`?pagina&tamano`) | A | Usuarios. Crear `{email, nombre, roles}` → contraseña temporal **una sola vez** |
| PATCH | `/usuarios/:id` (`{nombre?, roles?, activo?}`) | A | Usuarios. Desactivar o cambiar roles cierra sus sesiones |
| POST | `/usuarios/:id/restablecer-password` | A | Usuarios → contraseña temporal nueva (una vez) |
| GET / PATCH | `/configuracion` | todos / A (C: libro y WinConta) | Configuración |
| GET / PUT | `/configuracion/libro-modo/:anio` | todos / A, C | Configuración → Libro 12.1 |
| GET / POST / PATCH | `/establecimientos` | todos / A | Maestros |
| GET / POST / PATCH | `/productos` | todos / A, C | Maestros |
| GET | `/productos/stock` | todos | Dashboard, Kardex |
| GET / POST / PATCH | `/terceros` (`?q=&rol=`) | todos / A, C, S | Maestros, `SelectorTercero` |
| GET | `/terceros/validar-documento?tipo=&numero=` | todos | validación en vivo |
| GET / POST / PATCH | `/reglas-contables` | todos / A, C | Maestros |
| GET | `/comprobantes` · `/comprobantes/:id` | todos | Comprobantes |
| POST | `/comprobantes/compras` · `/comprobantes/ventas` | A, C, S | Compra, Venta |
| POST | `/comprobantes/mermas` (13 merma o 14 desmedro) · `/comprobantes/ajustes` | A, C | Merma o desmedro, Ajuste |
| PATCH | `/comprobantes/:id` | A, C (S: sus compras y ventas) | Comprobantes |
| POST | `/comprobantes/:id/anular` (`{motivo}`) | A, C | Comprobantes |
| POST | `/movimientos/:id/mover` (`{direccion: "ARRIBA"\|"ABAJO"}`) | A, C | Kardex |
| POST | `/comprobantes/simular-salida` | A, C, S | Venta (disponible y costo estimado) |
| GET | `/kardex?productoId&anio&mes` · `/kardex/alertas?anio` | todos | Kardex, Dashboard |
| POST | `/kardex/recalcular` | A | Kardex |
| GET | `/periodos?anio` | todos | Periodos |
| POST | `/periodos/:anio/:mes/cerrar` · `/reabrir` (`{motivo}`) | A, C | Periodos |
| POST | `/periodos/cerrar-en-bloque` | A | Periodos |
| GET / POST | `/periodos/:anio/cierre-anual/vista-previa` · `/periodos/:anio/cierre-anual` (`{confirmarReemplazo}`) | A, C | Cierre anual |
| GET / POST / PUT | `/saldos-iniciales?anio` · `/saldos-iniciales` · `/saldos-iniciales/:id` | todos / A, C / A, C | Saldos iniciales |
| GET | `/libros/12-1?anio&mes&productoId&formato=json\|pdf` | todos | Libro 12.1 |
| GET | `/libros/12-1/prueba-margenes` (sin parámetros) | A, C | Libro 12.1 |
| GET / POST | `/libros/12-1/impresiones` | todos / A, C | Libro 12.1, Periodos |
| GET | `/libros/13-1?anio&mes&productoId&detallado&formato=json\|pdf\|xlsx` | todos | Libro 13.1, Kardex |
| GET | `/reportes/toneladas` · `/costo-ventas` · `/resumen-anual` · `/margen` (`?anio&formato`) | todos | Reportes |
| GET | `/reportes/excel-contadora?anio` | A, C | Excel contadora |
| GET | `/asientos?anio&mes` (por tipo de asiento) · `/asientos/exportados?anio` | todos | Asientos |
| POST | `/asientos/winconta` (`{anio, mes, tipoAsiento, numeroAsiento, tipoCambio}`) | A, C | Asientos (descarga .xlsx) |
| GET / PUT | `/control-tonelaje?anio&formato` · `/control-tonelaje/:anio/:mes` | todos / A, C | Control de tonelaje |
| GET / POST | `/tomas-inventario?anio` · `/tomas-inventario` · `GET /tomas-inventario/:id` | todos / A, C | Toma de inventario |
| POST | `/tomas-inventario/:id/resolver` · `/tomas-inventario/:id/cerrar` | A, C | Toma de inventario |
| GET | `/dashboard?anio` | todos | Dashboard |
| POST | `/importacion/historico` | A | Importación y paridad |
| GET | `/importacion/paridad` (sin filtros) | A, C | Importación y paridad, Paridad con Excel |
| GET | `/respaldo/descargar` · `/respaldo/exportar-datos` | A | Respaldo |
| GET | `/auditoria` · `/auditoria/accesos` | A | Auditoría |

En `/usuarios` los roles van **sin prefijo** (`"CONTADOR"`); en el token y en `/auth/*`, **con prefijo** (`"inventario:CONTADOR"`). Un ADMIN no puede quitarse su rol ni desactivarse, y la API nunca deja el sistema sin ADMIN. Cada usuario trae `passwordTemporalExpira` (ISO, 72 h; `null` = no vence): pasada esa hora el login responde 401 y hay que restablecerla (tipo `Usuario` en `src/api/usuarios.ts`). Límites: login y cambiar-password 5/min, refresh 30/min.

### 6.1 Importación y paridad (S6, `src/api/importacion.ts`)

| Llamada | Respuesta |
|---|---|
| `POST /importacion/historico` (sin cuerpo) | **201** `{ loteId, hashSha256, resumen: { terceros, saldosIniciales, comprobantes, movimientos, controlTonelaje, periodos, kardexRecalculados, alertas: { CODIGO: n } } }` |
| | **409 `HISTORICO_YA_CARGADO`**: esos años ya tienen saldos o movimientos, o el mismo lote ya se aplicó. Se muestra como aviso informativo (repetir no duplica). |
| `GET /importacion/paridad` | **200** `{ filas: [{ anio, productoCodigo, kardex, resumen, libro }], asientos: [{ anio, asientos }], maxima: { guardado, motor }, alertas, detalle: [string], totalDiferencias }` |
| ambas | **409 `NO_DISPONIBLE_EN_DEMO`** con la API en modo demostración (`/salud` → `demo: true`): aviso en lugar del resultado. |

- Cada conteo trae dos caminos: `guardado` (valores de la base) y `motor` (recalculados al leer), con `{ comparados, diferencias }`; en `libro` también `nuevas` y `resueltas` (las diferencias conocidas cuentan como comparadas). La diferencia máxima es **una sola** para toda la respuesta (no hay por fila) y llega como texto (`"2.58e-10"`): se muestra tal cual. Tolerancia 0.000001.
- `paridad` no acepta `?anio` (devuelve todos los años).
- **Tiempos**: las dos tardan de 1 a 3 minutos. El front primero despierta la API con `GET /salud` (reintentos de §4) y luego llama con `tiempoMs: 240_000` por intento.
- **Corte del proxy**: en la nube Vercel → Render puede cortar antes de 240 s con 502/504 aunque la API siga procesando. Por eso el POST va con `proxyPuedeCortar: true` (el 502 cuenta como "quizá llegó") y nunca se repite solo: 502, 504 o tiempo agotado → `SIN_RESPUESTA` y la pantalla avisa que espere 2–3 minutos y pulse «Verificar paridad». Volver a cargar no duplica (409 `HISTORICO_YA_CARGADO`).
- No hay endpoint de "última carga" (pendiente para el S12).

### 6.2 Maestros, configuración y usuarios (S7)

Archivos: `src/api/{productos,terceros,reglas-contables,establecimientos,configuracion,catalogos,usuarios}.ts`. Claves de TanStack Query en `src/api/claves.ts`. Permisos de la pantalla en `lib/roles.ts` (`PERMISOS`, `puede`, `usePuede`), con la misma matriz que la API.

| Llamada | Cuerpo / respuesta | Errores que la pantalla muestra |
|---|---|---|
| `GET /productos` | arreglo completo (sin paginar) | — |
| `POST /productos` | `{codigo, codigoLibro, descripcion, tipoExistencia, unidadMedida, metodoValuacion, cuentaInventario, cuentaCostoVentas, denominacionContable}` | 409 `PRODUCTO_DUPLICADO` (junto al código), 422 `CODIGO_SUNAT_INVALIDO`, `CUENTA_INVALIDA` |
| `PATCH /productos/:id` | solo lo que cambió (nunca `codigo`) + `activo` | ídem |
| `GET /productos/stock?establecimientoId=` | `[{productoId, establecimientoId, anio, fechaUltimoMovimiento, cantidad, costoTotal, costoUnitario, alertas}]` (decimales string) | — |
| `GET /terceros?q=&rol=&pagina=&tamano=` | `{datos, total, pagina, tamano}` (la API pagina y busca) | — |
| `GET /terceros/validar-documento?tipo=&numero=` | `{valido, numero, codigo, mensaje, terceroId}`; la web la llama 400 ms después de escribir y solo con el largo completo (RUC 11, DNI 8) | `RUC_INVALIDO` / `DOCUMENTO_INVALIDO` en el campo; `terceroId` ≠ el propio → "Ya existe…" |
| `POST /terceros` | `{tipoDocumento, numeroDocumento (null con tipo 0), razonSocial (MAYÚSCULAS), pais, esProveedor, esCliente, direccion}` | 409 `TERCERO_DUPLICADO` (junto al número), 422 `RUC_INVALIDO` / `DOCUMENTO_INVALIDO` |
| `PATCH /terceros/:id` | solo lo que cambió (la API valida el documento solo si cambia) | 409 `TERCERO_PROTEGIDO` ("CLIENTES VARIOS") |
| `GET /reglas-contables` | arreglo completo | — |
| `POST /reglas-contables` | `{tipoAsiento, productoId (número), tipoOperacion, cuentaDebe, cuentaHaber, vigenteDesde "AAAA-MM", vigenteHasta "AAAA-MM" \| null, decision, descripcion}` | 409 `VIGENCIA_SUPERPUESTA` (con la vigencia pedida y las de las otras reglas del mismo tipo, producto y operación), 422 `OPERACION_NO_CORRESPONDE`, `VIGENCIA_INVALIDA`, `CUENTA_INVALIDA`, `PRODUCTO_INEXISTENTE` |
| `PATCH /reglas-contables/:id` | solo `{vigenteHasta?, decision?, descripcion?}` que cambiaron. "Cerrar regla" = `{vigenteHasta}` | 409 `VIGENCIA_SUPERPUESTA` |
| `GET / POST / PATCH /establecimientos` | `{codigo (4 dígitos, no cambia), nombre, textoLibro?}`; sin `textoLibro` la API arma `"<codigo>-<nombre>"` | 409 `ESTABLECIMIENTO_DUPLICADO` |
| `GET /configuracion` | `{empresa (solo lectura), inventario, libro, asientos, winconta (columnas: 19 fijo), tomaInventario, actualizadoEn}` | — |
| `PATCH /configuracion` | **una sección por pestaña**: Empresa → `{inventario, asientos}`; Libro → `{libro}`; WinConta → `{winconta}` (sin `columnas`); Toma → `{tomaInventario}` (`toleranciaDiferenciaTn` string) | 403 `SIN_PERMISO` si el CONTADOR tocara otra sección (la web no lo permite) |
| `GET / PUT /configuracion/libro-modo/:anio` | `{anio, modo, origen: ANIO \| POR_DEFECTO}` / `{modo}` | — |
| `POST /usuarios` | `{email, nombre, roles: ["CONTADOR"]}` → `{passwordTemporal, usuario}` | — |
| `PATCH /usuarios/:id` | `{nombre?, roles?}` o `{activo}` | la API impide que un ADMIN se quite su rol o se desactive (la web tampoco lo ofrece) |
| `POST /usuarios/:id/restablecer-password` | → `{passwordTemporal}` | — |

- La **contraseña temporal** se muestra una sola vez en `DialogoPasswordTemporal` y se descarta al cerrarlo. Las mutaciones que la traen usan `gcTime: 0` y `reset()`, para que no quede en la caché de TanStack Query.
- Un 400 `VALIDACION` con `detalle.campos` (`{campo: "mensaje"}` o `[{campo, mensaje}]`) se coloca junto a cada campo con `aplicarErrorDeApi` (`lib/formularios.ts`).
- Después de guardar se invalidan las claves del recurso. Productos y establecimientos también invalidan `stock`.

### 6.3 Comprobantes (S8, `src/api/comprobantes.ts`)

Pantallas en `src/funcionalidades/comprobantes/`. Decimales (cantidad, costo, valor de venta, tipo de cambio) **siempre string**, tal como se escribieron: la web no redondea. Permisos en `lib/roles.ts`: `compras:registrar` y `ventas:registrar` (A, C, S), `mermas:registrar` y `ajustes:registrar` (A, C), `comprobantes:anular` (A, C) y `puedeEditarComprobante` (A y C, todo lo registrado; S, solo las compras y ventas que registró: `creadoPorId` = id del usuario de la sesión, desde el S9). `ComprobanteDto` trae también `creadoPor` (nombre; `null` si el usuario ya no existe), que el detalle muestra como «Registrado por».

| Llamada | Cuerpo / respuesta |
|---|---|
| `POST /comprobantes/compras` | `{fecha, establecimientoId, serie, numero, terceroId, tipoComprobante: "01", guiaRemision?, ticketBalanza?, placaVehiculo?, observacion?, lineas: [{productoId, descripcion, cantidad, costoUnitario}]}` |
| `POST /comprobantes/ventas` | como la compra + `tipoComprobante: "01"\|"03"`, `tipoOperacion: "01"\|"17"` (con `03` la web siempre envía `01`), `moneda`, `tipoCambio` (solo USD) y `lineas[].valorVentaUnitario` |
| `POST /comprobantes/mermas` | `{fecha, establecimientoId, tipoOperacion: "13"\|"14", anioInforme (solo 13), sustento, lineas: [{productoId, descripcion, cantidad}]}` |
| `POST /comprobantes/ajustes` | `{fecha, establecimientoId, sustento, lineas: [{productoId, descripcion, cantidad, tipoMovimiento, costoAlPromedio: true \| costoUnitario}]}` (salida: sin costo) |
| `PATCH /comprobantes/:id` | **solo lo que cambió**; si cambian las líneas van todas, cada una con su `id` si se conserva (un precio vacío no se envía: la API conserva el guardado, D-11). Establecimiento y tipo de merma no se editan |
| `POST /comprobantes/:id/anular` | `{motivo}` (obligatorio) |
| `POST /comprobantes/simular-salida` | `{productoId, fecha, cantidad, establecimientoId}` → `{disponibleAntes, costoEstimado, saldoResultante, quedaNegativo…}`. No guarda; la venta la llama 400 ms después de escribir |
| `GET /comprobantes?pagina&tamano&naturaleza&desde&hasta&terceroId&productoId&estado&q` | `{datos, total, pagina, tamano}` (la API pagina y filtra) |
| `GET /comprobantes/:id` | cabecera + líneas con orden, costos y saldo después de cada movimiento |

Las escrituras responden `{comprobante, kardex}`. Después de registrar, editar o anular se invalidan kardex, alertas, stock, dashboard, periodos, saldos iniciales, comprobantes y productos (`invalidarTrasEscritura` de `api/claves.ts`).

Mes cerrado **antes de guardar** (S9): el formulario consulta `GET /periodos?anio` del año de la fecha (`useEstadoMes`). Si el mes está `CERRADO`, la Fecha muestra "El mes está cerrado. Para registrar o editar, un usuario Contador o Administrador debe reabrirlo en Periodos." y «Guardar» queda deshabilitado. El 409 `PERIODO_CERRADO` se sigue manejando (el mes pudo cerrarse mientras se llenaba el formulario).

**Dónde se muestra cada error** (`funcionalidades/comprobantes/errores-operacion.ts`, función pura con pruebas):

| Error | En la pantalla |
|---|---|
| 409 `STOCK_NEGATIVO_REQUIERE_CONFIRMACION` | `DialogoStockNegativo` (producto, fecha, disponible antes, saldo resultante; detalle de §5). "Registrar de todos modos" reenvía **la misma petición** con `confirmarStockNegativo: true`. También al editar y al anular |
| 409 `STOCK_INSUFICIENTE` (política BLOQUEAR) | aviso en el encabezado con producto, fecha y disponible; sin opción de confirmar |
| 409 `PERIODO_CERRADO` | aviso en el encabezado con el mes según la fecha + error en Fecha |
| 409 `ORDEN_EN_CONFLICTO` · `CONFLICTO_CONCURRENTE` | `AvisoConflicto`: "Otro usuario modificó estos datos al mismo tiempo." con **Reintentar**, que **vuelve a cargar los datos** (invalida las consultas; al editar, recarga el comprobante) y **no reenvía**: la persona revisa y vuelve a guardar. Cambió en el S9 (antes reenviaba) |
| 409 `COMPROBANTE_DUPLICADO` | junto al Número ("Ya existe la factura F001-0000123 de este proveedor") o al año del informe (merma 13) |
| 409 `COMPROBANTE_ANULADO` | aviso en el encabezado; el formulario queda en solo lectura |
| 422 `PRECIO_VENTA_REQUERIDO` | en el valor de venta de la línea (`detalle.linea` si viene; si no, las líneas sin valor) |
| 422 `TIPO_CAMBIO_REQUERIDO` · `SUSTENTO_REQUERIDO` · `SALDO_INICIAL_INEXISTENTE` · `TERCERO_INEXISTENTE` · `ESTABLECIMIENTO_INEXISTENTE` | junto a Tipo de cambio · Sustento · Fecha · Proveedor/Cliente · Establecimiento |
| 422 `REORDEN_FUERA_DE_FECHA` | aviso al mover en el Kardex (§6.4) |
| 403 `SIN_PERMISO` al editar siendo solo ASISTENTE | "Solo puedes editar las compras y ventas que registraste tú." |
| 400 `VALIDACION` | cada campo junto a su control (`terceroId` → Proveedor/Cliente, `lineas.N.costoUnitario`/`valorVentaUnitario` → precio de la línea N) |

Los pendientes del S8 para la API quedaron resueltos en el S9: `ComprobanteDto.creadoPorId`/`creadoPor`, los códigos `ORDEN_EN_CONFLICTO` y `CONFLICTO_CONCURRENTE` en el OpenAPI y el `detalle` de `STOCK_NEGATIVO_REQUIERE_CONFIRMACION` (`StockNegativoDetalleDto`).

### 6.4 Kardex, periodos y saldos iniciales (S9)

Módulos `src/api/kardex.ts`, `src/api/periodos.ts` y `src/api/saldos-iniciales.ts`; pantallas en `src/funcionalidades/kardex/`, `periodos/` y `saldos-iniciales/`. La web **no calcula** costos, saldos ni diferencias: muestra lo que entrega la API, formateado con big.js (`lib/formato.ts`). Permisos en `lib/roles.ts`: `kardex:reordenar` (A, C), `kardex:recalcular` (A), `periodos:cerrar` (A, C; también reabrir), `periodos:cerrar-en-bloque` (A), `periodos:cierre-anual` (A, C) y `saldos:editar` (A, C; editar y crear un saldo manual).

| Llamada | Cuerpo / respuesta | Pantalla |
|---|---|---|
| `GET /kardex?productoId&anio&mes?` | `KardexDto`: producto, `saldoInicialAnio` (origen y desactualizado), `saldoInicial`, `meses[]` (estado, SI, subtotales de entradas y salidas, saldo final y `filas[]` con entrada/salida/saldo y `alertas`), `saldoFinal`. Sin `mes`: todo el año | Kardex (filtros en la URL: `?producto&anio&mes=N\|todo&detallado=1`) |
| `GET /kardex/alertas?anio` | `{anio, totales, alertas[]}` (tipo, producto, movimiento, fecha, documento, mensaje) | Kardex (aviso superior con enlace `#fila-<movimientoId>`), Periodos (saldos negativos del mes antes de cerrar) |
| `POST /kardex/recalcular` | `{anio, productoId?}` → `{filas, filasCambiadas, saldosDesactualizados[]}` | Kardex (A), para el producto y año elegidos |
| `POST /movimientos/:id/mover` | `{direccion: "ARRIBA"\|"ABAJO", confirmarStockNegativo?}` → `{comprobante, kardex}` | Kardex (A, C): ↑/↓ solo entre filas de la misma fecha y en meses no cerrados, con confirmación |
| `GET /periodos?anio` | `{anio, meses[12], anioCompletoCerrado}`; cada mes: `estado` (`ABIERTO`, `CERRADO`, `SIN_PERIODO`), `cerradoEn`/`cerradoPor`, `versionCierre`, `movimientos`, `comprasTn`, `ventasTn`, `porProducto[]` (por producto: movimientos y TN), `libro121` (`{estado: PENDIENTE\|IMPRESO\|DESACTUALIZADO, impresoEn}`), `asiento` (`{estado: SIN_ASIENTO\|PENDIENTE\|EXPORTADO\|DESACTUALIZADO}`, real desde el S11: el peor estado de los tipos del mes) y `asientosExportados[]`. `libroImpreso` está obsoleto (se quita en el S13): **la web ya no lo usa** | Periodos (tarjetas con movimientos, TN y estado del libro con enlace al 12.1), chip de la barra superior, aviso de mes cerrado en los formularios, estado del mes en el Libro 12.1 |
| `POST /periodos/:anio/:mes/cerrar` | sin cuerpo → `{periodo, cierres, saldosNegativos[], diferenciasConCierreAnterior[]}` | Periodos (A, C) |
| `POST /periodos/:anio/:mes/reabrir` | `{motivo}` (obligatorio, hasta 500) → `{periodo, advertencias[]}` | Periodos (A, C), solo el último mes cerrado |
| `POST /periodos/cerrar-en-bloque` | `{desde: "AAAA-MM", hasta: "AAAA-MM"}` → `{cierres[]}` | Periodos (A) |
| `GET /periodos/:anio/cierre-anual/vista-previa` | `{mesesAbiertos[], requiereConfirmacion, saldos[]}`; cada saldo: `saldoFinal`, `propuesto` (4 y 2 decimales), `existente`, `comparacion`, `diferencia` (propuesto − existente) y `accion` | Cierre anual, pasos 1 y 2 |
| `POST /periodos/:anio/cierre-anual` | `{confirmarReemplazo? \| conservarExistentes?, confirmarStockNegativo?}` (no los dos primeros a la vez) → vista + `kardexRecalculados` | Cierre anual, paso 3 |
| `GET /saldos-iniciales?anio` | `SaldoInicialDto[]`: cantidad, costo total, `costoUnitario` (exacto, calculado en la API), origen (`IMPORTACION`, `CIERRE_ANUAL`, `MANUAL`), motivo, desactualizado, registrado por | Saldos iniciales (columna C.U. con 2 decimales) |
| `POST /saldos-iniciales` | `{anio, productoId, cantidad (≤ 4 dec.), costoTotal (≤ 10 dec.), motivo, establecimientoId?, confirmarStockNegativo?}` → el saldo `MANUAL` | Saldos iniciales (A, C): «Nuevo saldo manual», solo productos sin saldo en el año |
| `PUT /saldos-iniciales/:id` | `{cantidad (≤ 4 dec.), costoTotal (≤ 10 dec.), motivo, confirmarStockNegativo?}` → el saldo, ahora `MANUAL` | Saldos iniciales (A, C). Solo edita uno existente |

Después de cerrar, reabrir, cerrar en bloque, cierre anual, saldo manual, reordenar o recalcular se invalidan kardex, alertas, periodos, saldos iniciales, comprobantes, stock, dashboard, libro 12.1 y reportes (`invalidarTrasEscritura`).

**Dónde se muestra cada error:**

| Error | En la pantalla |
|---|---|
| 409 `PERIODO_ANTERIOR_ABIERTO` · `PERIODO_POSTERIOR_CERRADO` · `PERIODO_CERRADO` | dentro del diálogo de cerrar / reabrir (mensajes de UI-UX §6) |
| 422 `PERIODO_FUTURO` · `PERIODO_ANTERIOR_AL_INICIO` · 409 `PERIODO_NO_CERRADO` | dentro del diálogo de cerrar, cerrar en bloque o reabrir, con su mensaje |
| 409 `CIERRE_CON_SALDO_CERO_CON_COSTO` | el diálogo sigue abierto, con el mensaje del mes y la **lista de movimientos** con enlace al kardex. Desde el S10 el detalle está tipado (`ErrorSaldoCeroDto`: `detalle.periodo` y `detalle.movimientos[]` con `movimientoId`, `productoId`, `productoCodigo`, `fecha`, `orden` y `saldoCosto`); si no viene, se usan las alertas `SALDO_CERO_CON_COSTO` del mes |
| 409 `SALDO_INICIAL_YA_EXISTE` (POST de saldo inicial) | junto al producto: "Ya existe un saldo inicial de {producto} para {año}. Edítalo desde la tabla." y se recarga la tabla |
| 409 `SALDO_INICIAL_REQUIERE_CONFIRMACION` | el asistente vuelve al paso 2 con el mensaje y recarga la vista previa |
| 409 `CIERRE_ANUAL_INCOMPLETO` | el asistente vuelve al paso 1 |
| 409 `STOCK_NEGATIVO_REQUIERE_CONFIRMACION` | `DialogoStockNegativo` y reenvío con `confirmarStockNegativo: true` (mover, cierre anual y saldo manual nuevo o editado) |
| 409 `ORDEN_EN_CONFLICTO` · `CONFLICTO_CONCURRENTE` | `AvisoConflicto` con **Reintentar** que recarga y no reenvía |
| 422 `REORDEN_FUERA_DE_FECHA` · 409 `COMPROBANTE_ANULADO` al mover | aviso (toast persistente) |

Pendientes del contrato para la API (Sprint 11): ver `docs/AVANCE.md` (S10 → Pendientes para la API).

### 6.5 Libros, reportes y descargas (S10)

Módulos `src/api/libros.ts`, `src/api/reportes.ts` y `src/api/descargas.ts`; pantallas en `src/funcionalidades/libros/` y `reportes/`. La web **no calcula** nada: la vista previa del 12.1 muestra las cifras tal como llegan (ya redondeadas como se imprimen) y los reportes se formatean con big.js. Permisos: `libros:registrar-impresion`, `libros:prueba-margenes`, `libros:13-1-detallado` (D-33) y `reportes:excel-contadora`, los cuatro A y C.

| Llamada | Cuerpo / respuesta | Pantalla |
|---|---|---|
| `GET /libros/12-1?anio&mes?&productoId?` | `Libro121Dto`: `modo` (`AGRUPADO`/`DETALLADO`), `bloques[]` (uno por mes y producto: cabecera, saldo inicial, filas, totales, saldo final y, desde el S11, `estadoMes` y `borrador`) y `borrador` (algún bloque es de un mes no cerrado: el PDF sale con la franja BORRADOR). Sin `mes`: año completo; sin `productoId`: todos | Libro 12.1 (vista previa tipo hoja A4; con `borrador`, aviso junto a «Descargar PDF» y la franja en cada bloque) |
| `GET /libros/12-1?…&formato=pdf` | PDF A4 horizontal sin folio | Libro 12.1 «Descargar PDF» (todos) |
| `GET /libros/12-1/prueba-margenes` | PDF de una página (área imprimible y zona del sello) | Libro 12.1 (A, C) |
| `GET /libros/12-1/impresiones?anio` | `{impresiones[], meses[12]}`: estado por mes (`PENDIENTE`, `IMPRESO`, `DESACTUALIZADO`, `impresoEn`) e historial (`impresoEn`, `impresoPor`, `observacion`, `vigente`, `reimpresion`) | Libro 12.1 (estado del mes e impresiones registradas) |
| `POST /libros/12-1/impresiones` | `{anio, mes, observacion?}` → la impresión. Sin fecha: la pone el servidor (`impresoEn`). Solo meses `CERRADOS` | Libro 12.1 «Registrar impresión» (A, C). Luego se invalidan periodos y libro 12.1 |
| `GET /libros/13-1?anio&mes?&productoId?&detallado?&formato=pdf\|xlsx` | PDF o Excel del 13.1. `detallado=true` solo A y C (ASISTENTE y CONSULTA → 403): la web no lo envía para otros roles | Libro 13.1 y botones «PDF 13.1» y «Excel» del Kardex (mismos filtros) |
| `GET /reportes/toneladas?anio&formato?` | `ToneladasDto`: por producto, `meses[]` y `total` (SI, compras, otras entradas, ventas, mermas, desmedros, otras salidas, SF en TN) y el bloque `enToneladas` | Toneladas |
| `GET /reportes/costo-ventas?anio&formato?` | `CostoVentasDto`: por producto y `resumen`, cada mes con `costoVentas` (01 + 17), `mermas` y `totalSalidasValorizadas` | Costo de ventas |
| `GET /reportes/resumen-anual?anio&formato?` | `ResumenAnualDto`: por producto y `total`, inventario inicial, compras, inventario final, costo de ventas, mermas… (TN y S/) y `totalSalidasValorizadas` | Resumen anual (conceptos × productos + TOTAL) |
| `GET /reportes/margen?anio&formato?` | `MargenDto`: por producto y `total`, ventas TN y S/, costo de ventas, `margen`, `porcentaje` (null sin ventas con precio) y `sinPrecio` aparte | Margen (tablas y gráfico de barras) |
| `GET /reportes/excel-contadora?anio` | `.xlsx` con las hojas de la contadora (valores, no fórmulas) | Excel contadora (A, C) |

**Descargas** (`BotonDescarga` → `descargarArchivo` → `solicitarArchivo` de `api/cliente.ts`): el mismo cliente (token en memoria, refresh, un reintento tras 401 y "Despertando el servidor…"), `Accept: */*` y 120 s por intento. El archivo se guarda con el nombre de `Content-Disposition` (`filename*` UTF-8 o `filename`); si no viene, con un nombre por defecto. Mientras se genera el botón dice "Generando…" (`aria-busy`). Errores (toast que no se cierra solo):

| Error | Mensaje |
|---|---|
| 403 `SIN_PERMISO` | No tienes permiso para descargar este archivo. |
| 409 `PERIODO_NO_CERRADO` | Ese mes aún no está cerrado: el archivo se genera después de cerrarlo en Periodos. |
| 429 (cualquier código) | Llegaste al límite de descargas por minuto. Espera un momento y vuelve a intentarlo. |
| otro | el de UI-UX §6 según el `codigo` |

**Pendiente en el OpenAPI** (anotado para la API del Sprint 11 en `docs/AVANCE.md`): el 429 de las descargas de `/libros` y `/reportes`, el rol de `GET /libros/12-1/prueba-margenes` y el 409 `PERIODO_NO_CERRADO` de la descarga del 12.1 si la API lo devuelve. El OpenAPI del S11 ya documenta el 429 de `/reportes` y `/asientos`.

### 6.6 Asientos, control de tonelaje y toma de inventario (S11)

Módulos `src/api/asientos.ts`, `src/api/control-tonelaje.ts` y `src/api/tomas-inventario.ts`; pantallas en `src/funcionalidades/asientos/`, `control-tonelaje/` y `toma-inventario/`. La web **no calcula** importes, diferencias ni saldos: muestra lo que entrega la API. Solo compara Debe = Haber con big.js para el texto "Cuadra". Permisos en `lib/roles.ts`: `asientos:exportar`, `tonelaje:editar` y `tomas:gestionar` (crear, resolver y cerrar), los tres A y C.

| Llamada | Cuerpo / respuesta | Pantalla |
|---|---|---|
| `GET /asientos?anio&mes` | `AsientosMesDto`: `estadoMes` y `asientos[]` (uno por tipo: `COSTO_VENTAS`, `MERMA`, `DESMEDRO`, `AJUSTE_FALTANTE`, `AJUSTE_SOBRANTE`). Cada uno trae `glosa`, `numeroComprobante`, `lineas[]` (`cuenta`, `lado` D/H, `exacto` y `redondeado` a 2 decimales), `reglas[]`, `faltantes[]` (movimientos sin regla), `totalDebe`, `totalHaber`, `exportable`, `motivoNoExportable` (`PERIODO_NO_CERRADO`, `REGLA_CONTABLE_FALTANTE`, `ASIENTO_VACIO`) y `exportacion` (`{estado, numeroAsiento, exportadoEn}`). Funciona también con el mes abierto (vista previa) | Asientos (`?anio&mes&grupo`): una pestaña por grupo (Ajustes reúne faltante y sobrante) |
| `GET /asientos/exportados?anio` | `{anio, exportaciones[]}`: mes, tipo, `numeroAsiento`, `tipoCambio`, `totalDebe`, `archivoNombre`, `exportadoEn`, `exportadoPor`, `vigente` (la última de ese mes y tipo) y `desactualizado` (solo la vigente) | Asientos: historial del año |
| `POST /asientos/winconta` | `{anio, mes, tipoAsiento, numeroAsiento (4 dígitos, texto), tipoCambio (> 0, ≤ 3 decimales, texto)}` → `.xlsx` de 19 columnas (Content-Disposition) y registra la exportación | Asientos «Exportar a WinConta» (A, C) |
| `GET /control-tonelaje?anio&formato?` | `{anio, meses[12], mesesConDiferencia}`; cada mes: `comprasKardex` (entradas 02), `hayDiferencia` y `reportes[]` (`fuente`, `toneladasReportadas`, `diferencia` = reportado − compras, `hayDiferencia`, `nota`, `observacion`). Con `formato=xlsx`, el Excel | Control de tonelaje (y «Descargar Excel») |
| `PUT /control-tonelaje/:anio/:mes` | `{toneladasReportadas (≤ 4 dec., obligatorio), fuente? ("REPORTE EXTERNO" por defecto), observacion?}` → el mes. Registra o **reemplaza** el reporte de esa fuente | Control de tonelaje (A, C). Al editar, la fuente queda fija; una observación vacía no se envía |
| `GET /tomas-inventario?anio` | `TomaDto[]` (más recientes primero): fecha, establecimiento, `estado` (`BORRADOR`, `CERRADA`), `resuelta`, responsable, observación, creado por/en, `lineas[]` y `comprobantes[]` | Toma de inventario (lista) |
| `POST /tomas-inventario` | `{fecha, establecimientoId? (0001 por defecto), responsable, observacion?, lineas: [{productoId, cantidadContada (≤ 4 dec.)}]}` → la toma con `cantidadSistema` (saldo del kardex a la fecha), `diferencia`, `tipoDiferencia` (`FALTANTE`, `SOBRANTE`, `SIN_DIFERENCIA`) y `dentroDeTolerancia` | Nueva toma (pasos 1 y 2) y «Volver a calcular» |
| `GET /tomas-inventario/:id` | la toma | Detalle (pasos 3 y 4) |
| `POST /tomas-inventario/:id/resolver` | `{lineas: [{productoId, accion: MERMA\|AJUSTE\|NINGUNA, observacion?}] (una por cada producto con diferencia), sustentoMerma?, anioInforme?, sustentoAjuste?, confirmarStockNegativo?}` → la toma con sus `comprobantes` (como máximo una merma 13 y un ajuste 28, enlazados) | Detalle, paso 4 (A, C) |
| `POST /tomas-inventario/:id/cerrar` | sin cuerpo → la toma `CERRADA` (todas las diferencias resueltas; sin diferencias se cierra directo) | Detalle, «Cerrar toma» (A, C) |

**Exportar a WinConta**: `descargarArchivoPost` → `solicitarArchivo` con `metodo: 'POST'` y `cuerpo` (mismo token, refresh, "Despertando el servidor…" y 120 s). Al ser una escritura, ante un 504 o tiempo agotado **no se repite sola** (`SIN_RESPUESTA`). Tras exportar se invalidan asientos, periodos y dashboard.

Además, toda escritura (`invalidarTrasEscritura`) invalida ahora asientos, control de tonelaje y tomas: el asiento exportado puede quedar desactualizado, las compras del kardex cambian y una toma en borrador puede quedar desactualizada.

**Dónde se muestra cada error:**

| Error | En la pantalla |
|---|---|
| 409 `PERIODO_NO_CERRADO` (exportar) | en el diálogo: "Ese mes aún no está cerrado: el asiento se exporta a WinConta después de cerrarlo en Periodos." y se recargan los asientos |
| 422 `REGLA_CONTABLE_FALTANTE` · `ASIENTO_VACIO` (exportar) | en el diálogo, con su mensaje, y se recargan los asientos |
| 400 `VALIDACION` (exportar, tonelaje, nueva toma) | junto al campo (`numeroAsiento`, `tipoCambio`, `toneladasReportadas`, `fuente`, `observacion`, `fecha`, `responsable`) |
| 429 (exportar) | "Llegaste al límite de descargas por minuto…" |
| 409 `PERIODO_CERRADO` (nueva toma) | el asistente vuelve al paso 1 con el mensaje en la Fecha (también se avisa antes, con `useEstadoMes`) |
| 409 `STOCK_NEGATIVO_REQUIERE_CONFIRMACION` (resolver) | `DialogoStockNegativo` del S8 y reenvío con `confirmarStockNegativo: true` |
| 409 `TOMA_DESACTUALIZADA` (resolver) | aviso con **Volver a calcular**: `POST /tomas-inventario` con la misma fecha, establecimiento, responsable, observación y cantidades, y abre la toma nueva. La anterior queda en BORRADOR y la lista la marca "Reemplazada por la toma del <fecha y hora>" (otra toma posterior de la misma fecha y establecimiento) |
| 409 `TOMA_YA_RESUELTA` · `TOMA_YA_CERRADA` · `TOMA_CON_DIFERENCIAS_PENDIENTES` | mensaje en el paso 4 y se recarga la toma |
| 422 `ACCION_NO_CORRESPONDE` · `OBSERVACION_REQUERIDA` · `SUSTENTO_REQUERIDO` | mensaje en el paso 4 (zod ya los valida antes de enviar) |
| 409 `PERIODO_CERRADO` (resolver) | mensaje con el mes |
| 409 `CONFLICTO_CONCURRENTE` · `ORDEN_EN_CONFLICTO` | `AvisoConflicto` (recarga, no reenvía) |

**Pendiente para la API (S12)**: un endpoint para anular o recalcular una toma en BORRADOR, para que no queden tomas sueltas al «Volver a calcular».


## 7. Ejemplos (datos de demostración)

`POST /comprobantes/compras`
```json
{
  "tipoComprobante": "01", "serie": "F001", "numero": "123", "fecha": "2026-03-15",
  "terceroId": 2, "guiaRemision": "T001-0000456", "ticketBalanza": "B-0001",
  "lineas": [
    { "productoId": 1, "descripcion": "Chatarra pesada", "cantidad": "10.0000", "costoUnitario": "100.000000" },
    { "productoId": 2, "descripcion": "Chatarra inox B", "cantidad": "2.5000", "costoUnitario": "1000.000000" }
  ]
}
```

`POST /comprobantes/ventas` (exportación en dólares)
```json
{
  "tipoComprobante": "01", "serie": "E001", "numero": "45", "fecha": "2026-03-20",
  "terceroId": 5, "tipoOperacion": "17", "moneda": "USD", "tipoCambio": "3.700",
  "lineas": [ { "productoId": 2, "descripcion": "Contenedor 1x20", "cantidad": "20.0000", "valorVentaUnitario": "900.00" } ]
}
```

Respuesta 201 de cualquier escritura: el comprobante con sus líneas y, por cada kardex afectado, `{ productoId, anio, saldoFinal: { cantidad, costoTotal, costoUnitario }, alertas: [...] }` → invalidar en TanStack Query: kardex, stock, dashboard, periodos y comprobantes.
