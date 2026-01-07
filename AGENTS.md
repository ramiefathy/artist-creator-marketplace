# Repository Guidelines

## Project Structure & Module Organization

- `packages/web/`: Next.js app (App Router). Routes live in `packages/web/app/**/page.tsx`; shared UI in `packages/web/src/components`; client utilities in `packages/web/src/lib`.
- `functions/`: Firebase Cloud Functions (v2) in TypeScript. Main entry is `functions/src/index.ts`, organized by trigger type (`callable/`, `webhooks/`, `scheduled/`, `triggers/`) plus `utils/` and request `schemas/`.
- `packages/shared/`: shared TypeScript types/constants and JSON Schemas (AJV) intended for reuse across packages.
- Infra/config: `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `apphosting.yaml`.

## Build, Test, and Development Commands

From repository root:

- `npm install` (or `npm run install:all`): install workspace dependencies.
- `npm run build`: builds `packages/shared`, `functions`, and `packages/web`.
- `npm run emulators`: starts Firebase emulators with import/export under `.emulator-data/`.
- `npm run dev:web`: starts Next.js dev server at `http://localhost:3000`.
- `npm test`: runs the Functions test suite.
- `npm --workspace functions run lint`: ESLint for Cloud Functions.
- `npm --workspace packages/web run lint`: `next lint` for the web app.

## Coding Style & Naming Conventions

- TypeScript everywhere with `strict: true`; prefer explicit types at module boundaries.
- Indentation: 2 spaces. Keep files small and grouped by domain (e.g., callable functions in `functions/src/callable/`).
- File naming: camelCase TypeScript modules in `functions/src` (e.g., `autoApproveDeliverables.ts`). Next routes follow framework conventions (`packages/web/app/<route>/page.tsx`).

## Testing Guidelines

- Backend tests use Jest + ts-jest. Add tests as `functions/src/**/__tests__/*.test.ts` (or `*.test.ts`) and keep them deterministic (prefer emulators over live services).
- No frontend test runner is currently configured; keep any additions workspace-scoped and documented in `packages/web/package.json`.

## Commit & Pull Request Guidelines

- This checkout may not include `.git` history. Default to Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`) unless the upstream repo uses a different pattern.
- PRs should include: a clear summary, local verification steps (emulators + UI flow), screenshots for UI changes, and notes for any rule/index/config changes.

## Security & Configuration Tips

- Never commit secrets. Use `packages/web/.env.local` and `functions/.env.local` (copy from the provided `.env.example` files).
- Stripe secrets should be stored as Firebase Functions secrets (`firebase functions:secrets:set ...`). Storage reads are denied by rules; access protected assets via signed URLs issued by Functions.
