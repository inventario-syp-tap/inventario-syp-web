---
name: cerrar-sprint
description: Cierra la parte WEB de un sprint en el repo público inventario-syp-web. Verifica todo (incluida la ausencia de datos reales), actualiza AVANCE, hace el commit con la identidad del equipo y, solo si el usuario responde "sí" a cada pregunta, hace el merge a main y el push. Úsala únicamente cuando el usuario escriba /cerrar-sprint.
argument-hint: "<NN> <nombre-corto>   (ejemplo: /cerrar-sprint 05 base-web)"
arguments: [numero, nombre]
disable-model-invocation: true
allowed-tools: Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git add *) Bash(git commit *) Bash(git config --get *) Bash(git config --file ../.gitconfig-equipo --get *) Bash(git var *) Bash(git shortlog *) Bash(node scripts/revisar-datos-publicos.mjs *) PowerShell(git status *) PowerShell(git diff *) PowerShell(git log *) PowerShell(git add *) PowerShell(git commit *) PowerShell(git config --get *) PowerShell(git config --file ../.gitconfig-equipo --get *) PowerShell(git var *) PowerShell(git shortlog *) PowerShell(node scripts/revisar-datos-publicos.mjs *)
---

# Cerrar el sprint $numero ($nombre) — inventario-syp-web (repo PÚBLICO)

## Situación al invocar
- Rama actual: !`git branch --show-current`
- Correo de Git en este repo: !`git config --get user.email`
- Nombre de Git en este repo: !`git config --get user.name`
- Cambios sin commit:
!`git status --short`
- Últimos commits:
!`git log --oneline -8`

Sigue estos pasos **en orden**. Si un paso falla, detente, explica en palabras simples qué pasó y qué hacer, y no sigas.

## 1. Rama correcta
Debe ser `sprint/$numero-$nombre` (o empezar con `sprint/$numero`). Si estás en `main` u otra rama, detente y muestra los comandos para pasar a la rama correcta.

## 2. Identidad del equipo (obligatorio)
- `git var GIT_AUTHOR_IDENT` y `git var GIT_COMMITTER_IDENT` deben mostrar el nombre y el correo del equipo. El correo efectivo (`git config --get user.email`) debe ser **igual** al del archivo del equipo (`git config --file ../.gitconfig-equipo --get user.email`) y el nombre debe ser `Enrique Valdez Alva y Lenyn Mitchel Rodriguez Benites`. Si el archivo no existe, si no coinciden o si el nombre es otro: **detente**, nada de commits; indica revisar el paso 4 del LÉEME (`.gitconfig-equipo` e `includeIf` de `C:/proyectos/inventario-syp/`). No escribas el correo en ningún archivo de este repo público.
- `git shortlog -sne main..HEAD` y `git log main..HEAD --format="%h %an <%ae> | %cn <%ce> | %(trailers:key=Co-authored-by,valueonly,separator=%x2C )"`: autor y committer siempre el equipo; el único coautor aceptado es Claude con el correo `noreply@anthropic.com` (el nombre puede incluir el modelo, p. ej. `Claude Opus 5.5 <noreply@anthropic.com>`) (lo agrega Claude Code). Si aparece **cualquier otra persona o correo**, detente y explica (no reescribas el historial por tu cuenta). Este repo es público: lo que se suba queda a la vista de todos.
- `git config --get remote.origin.url`: si existe, debe apuntar a `github.com/inventario-syp-tap/inventario-syp-web` (si apunta a otro lugar, detente). Si no existe, continúa: el sprint se cierra en local y no habrá push.

## 3. Verificación completa
- `pnpm run lint`, `pnpm test`, `pnpm run build` y, si existe, `pnpm run test:e2e` (necesita la API levantada con `pnpm run start:demo` y la variable `E2E_PASSWORD` en esta terminal; si falta algo, pide al equipo que la ejecute en su terminal y te pegue el resultado).
- `node scripts/revisar-datos-publicos.mjs` debe decir **SIN DATOS REALES**. Si encuentra algo, detente y muestra cada hallazgo con su archivo y línea: se reemplaza por datos de demostración (`docs/UI-UX.md` §10) antes de seguir.
- `node .claude/hooks/probar-hooks.mjs` → Hooks OK.

## 4. Nada sensible en el commit
`git status --short` no debe mostrar `.env` (salvo `.env.example`), capturas con datos reales, archivos de `../inventario-syp-api` ni `src/api/esquema.d.ts` editado a mano (debe coincidir con `pnpm run api:tipos`).

## 5. Bitácora
`docs/AVANCE.md`: marca el sprint como `✅ terminado` con la fecha de hoy (dd/mm/aaaa) en "Estado actual" y agrega en "Bitácora" una sección `### S$numero — $nombre (dd/mm/aaaa)` con **Qué se hizo**, **Decisiones**, **Pendientes** y **Cómo probar** (URL, usuario de demostración y pasos). Las evidencias del TAP se anotan en el repo de la API (`../inventario-syp-api/docs/tap/05-EVIDENCIAS.md`): dile al equipo qué capturas tomar y que lo registren allí.

## 6. Commit (local)
`git add -A`, revisa `git status --short` y haz un commit con Conventional Commits en español, por ejemplo `feat(kardex): pantalla del kardex con alertas y reordenamiento (sprint $numero)`, con 3 a 6 viñetas en el cuerpo. Sin nombres de personas en el mensaje. Luego `git log -1 --format="%an <%ae> | %cn <%ce> | %(trailers:key=Co-authored-by,valueonly,separator=%x2C )"` debe mostrar solo al equipo (y a Claude como coautor); si no, detente antes de cualquier push.

## 7. Merge y push (cada uno solo con confirmación)
Muestra un resumen de 5 líneas y pregunta exactamente: **"¿Hago el merge a main? (sí/no)"**. Espera la respuesta.
- Si responde **sí**, ejecuta uno por uno:
  1. `git switch main`
  2. Solo si existe `origin`: `git pull --ff-only`
  3. `git merge --no-ff sprint/$numero-$nombre -m "chore: merge del sprint $numero ($nombre)"`
  4. Solo en el sprint 13: `git tag -a v1.0.0 -m "Sistema de Inventario S&P v1.0.0"`
- Después, **solo si existe `origin`**, pregunta exactamente: **"¿Hago el push a GitHub (repo PÚBLICO)? (sí/no)"**. Si responde **sí**, uno por uno: `git push -u origin sprint/$numero-$nombre`, `git push origin main` y, en el sprint 13, `git push origin v1.0.0`.
- **Nunca** `--force`. Si el push es rechazado o pide otra cuenta, detente y explica (LÉEME: pasos 4 y 6 y "Problemas frecuentes"). Si responde **no** a alguna pregunta, deja el commit y explica cómo hacerlo después; el siguiente sprint debe empezar desde un `main` que ya tenga este merge.

## 8. Cierre
Indica: (a) revisar en GitHub → `inventario-syp-web` → **Actions** que el CI quede en verde; (b) desde el Sprint 6, revisar en Vercel que el despliegue de `main` terminó ("Ready") y abrir la URL; (c) el **siguiente paso concreto** (el siguiente prompt de `../inventario-syp-api/docs/11-PROMPTS-CLAUDE-CODE.md`).
