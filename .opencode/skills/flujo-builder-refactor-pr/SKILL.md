---
name: flujo-builder-refactor-pr
description: Orquesta el flujo completo de una HU/issue de principio a fin: implementa con el agente builder (TDD), refactoriza con el agente refactor y abre un Pull Request hacia la rama dev. Úsalo cuando se pida "flujo", "builder + refactor + PR a dev", entregar una rama, implementar una issue completa o abrir PR a dev.
---

# Flujo builder → refactor → PR a dev

Ejecuta este flujo cuando haya que entregar una issue completa: implementación
TDD, refactorización y Pull Request contra `dev`. La base **siempre** es `dev`;
nunca `main`.

## Entradas

- Número de issue de GitHub (`gh issue list --label historia-de-usuario` si no
  se indicó; pregunta antes de continuar si hay ambigüedad).
- Nombre de rama: `feature/<nombre>` o `fix/<nombre>`.
- Rama base del PR: `dev`.

## Paso 0 — Preparar la rama

1. `git status --short` debe estar limpio. Si hay cambios sin commitear, detente
   y pregunta antes de tocar nada.
2. `git fetch origin`.
3. `git checkout dev && git pull --ff-only origin dev`.
4. Crea la rama: `git checkout -b feature/<nombre>` (o `fix/<nombre>`).
5. Marca la issue: `gh issue edit <n> --add-label en-progreso`.

No trabajes directamente sobre `dev` ni sobre `main`.

## Paso 1 — Builder (implementación TDD)

Invoca al subagente `builder` con la herramienta Task (`subagent_type: builder`)
usando un prompt que incluya:

- La issue: `#<n>`, título, alcance, RF, RNF y criterios de aceptación
  (`gh issue view <n>`).
- "La rama ya existe y está creada desde `dev`; quédate en ella, **no crees
  otra rama**."
- "Sigue TDD: test que falla primero, luego implementación hasta verde."
- "**No delegues** a `refactor` ni a `mutation`; el flujo los coordina."
- "**No cierres** la issue ni abras PR; lo hace este flujo al final."
- "Entrégame: archivos creados/modificados, tests añadidos y resultado de
  `npm test -- <modulo>`."

Al volver, ejecuta `npm test` y confirma que todo está en verde antes de seguir.

## Paso 2 — Refactor (patrones de diseño)

Invoca al subagente `refactor` con la herramienta Task (`subagent_type:
refactor`) usando un prompt que incluya:

- Los archivos que tocó el builder (diff contra `dev`: `git diff --name-only dev`).
- "Revisa **solo** el código de esta issue."
- "No cambies comportamiento: los tests deben seguir verdes en todo momento."
- "Respeta el límite de 300 líneas por archivo y divide si hace falta."
- "Entrégame: patrón aplicado, archivos reorganizados y justificación."

Al volver, vuelve a ejecutar `npm test`.

## Paso 3 — Validación antes del PR

Comprueba y corrige lo que falte:

- `npm test` en verde.
- `npm run test:coverage` con cobertura >90% en el código nuevo.
- `npx prettier --write <archivos .js modificados>`.
- Cada endpoint nuevo o cambiado está documentado en el bloque `@openapi` del
  router (visible en `/docs`) **y** en `README.md`, según `AGENTS.md`.
- Ningún archivo supera las 300 líneas.
- `git diff --check` sin errores de whitespace ni marcadores de conflicto.
- No hay secretos, tokens ni credenciales en el diff.

Si algo falla, corrígelo o vuelve a delegar al agente adecuado; no abras el PR
con tests rojos.

## Paso 4 — Commits

- Revisa `git status` y `git diff`; agrega solo archivos intencionales.
- Agrupa cambios coherentes en commits pequeños.
- Usa el estilo del repo (conventional commits en español), por ejemplo:
  - `feat(<modulo>): <descripción> (HU-<n>)`
  - `fix(<modulo>): <descripción> (HU-<n>)`
  - `test(<modulo>): <descripción>`
  - `docs(<modulo>): <descripción>`
- No hagas `amend`, `force-push` ni commits vacíos sin pedirlo.

## Paso 5 — Push y Pull Request a dev

1. `git push -u origin <rama>`.
2. Abre el PR contra `dev` únicamente:

   ```bash
   gh pr create \
     --base dev \
     --head <rama> \
     --title "<tipo>(<modulo>): <descripción> (HU-<n>)" \
     --body-file <(cat <<'EOF'
   ## Qué cambia

   <resumen breve>

   ## Issue

   Closes #<n>

   ## Cómo probar

   - `npm test`
   - <pasos manuales relevantes>

   ## Checklist

   - [x] Tests en verde
   - [x] Cobertura >90%
   - [x] Swagger actualizado
   - [x] README actualizado
   - [x] Prettier aplicado
   - [x] Sin secretos en el diff
   EOF
   )
   ```

3. **No hagas merge**: el PR queda a revisión contra `dev`.
4. Deja la issue abierta con `Closes #<n>` en el PR (GitHub la cerrará al
   mergear). No la cierres a mano.

## Paso 6 — Reporte final

Entrega al usuario, de forma breve:

- URL del PR (`gh pr view --json url -q .url`).
- Rama creada y base (`dev`).
- Resumen de la implementación y del refactor (patrón aplicado).
- Resultado de `npm test` / cobertura.
- Riesgos o seguimientos pendientes, si los hay.

## Reglas del flujo

- Nunca pushees directo a `dev` ni a `main`.
- Nunca mergees el PR ni uses `--force` sin autorización explícita.
- Nunca commitees secretos o `.env`.
- Si el builder o el refactor rompen tests, detente y corrige antes de seguir.
- Un PR por issue y por rama.
