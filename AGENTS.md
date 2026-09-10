# AGENTS.md

## Project state
Express 5 API (CommonJS, Node 24) that talks to Postgres through Sequelize 6 (`pg`), never raw `pg` queries. `README.md` is still the untouched GitLab template — ignore it; trust `package.json`, `app.js`, and `.opencode/agents/`.

## Commands
- `npm start` runs the API (`node index.js`); `npm run dev` uses `node --watch`.
- `npm test` runs Jest; single module: `npm test -- <nombre_modulo>` (e.g. `npm test -- health`). `npm run test:coverage` for coverage.
- Prettier is installed: `npx prettier --write <archivo>` or `npm run format`. No lint or typecheck tooling exists.
- `docker-compose up` builds `api` + `postgres:17-alpine` (`db`). Only standalone `docker-compose` v1 is installed on this machine; the `docker compose` plugin is not.
- Env vars: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (see `.env.example`); Sequelize defaults to `bread_king` on `localhost:5432`.

## Structure
- `index.js` boots the server; `app.js` builds the Express app (tested with supertest).
- One folder per module: `<modulo>/index.js` (Express router) + `<modulo>/<modulo>.test.js`. Existing: `hello` (`GET /hello-world`), `health` (`GET /health`, returns 503 when the DB is unreachable).
- `database/index.js` exports the shared Sequelize instance.

## Workflow conventions (enforced by `.opencode/agents/`)
- TDD: failing Jest test `<modulo>.test.js` first, then implementation in `<modulo>/index.js`.
- Coverage target >90%; mutation score target >80% (delegate to `@mutation`), then `@refactor` for design patterns.
- One branch per task: `feature/<name>` or `fix/<name>`. Tasks live as files under `issues/to-do`, moving to `issues/doing` (directories do not exist yet).

## Rules
- Always run `npm test` after any change to prove the new feature doesn't break existing behavior.
- Format every changed `*.js` file with Prettier (`npx prettier --write <archivo>`) before finishing.
- No file may exceed 300 lines; split it into smaller modules when it approaches that limit.

## Gotchas
- The `origin` remote URL still embeds a plaintext GitLab personal access token (`glpat-REDACTED`), and it remains in git history even though it was removed from `package.json`. Never print, copy, or commit it; rotate it.
- Remote is GitLab, so GitHub CLI (`gh`) is not usable here.
