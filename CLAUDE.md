# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Development Commands

```bash
# Install all workspace dependencies (from repo root)
npm install

# Build all packages (shared → functions → web)
npm run build

# Start Firebase emulators with persistent data (stored in .emulator-data/)
npm run emulators

# Start Next.js dev server (separate terminal)
npm run dev:web

# Run Functions test suite
npm test

# Run a single test file
npm --workspace functions run test -- path/to/file.test.ts

# Lint
npm --workspace functions run lint      # ESLint for Cloud Functions
npm --workspace packages/web run lint   # next lint for web app

# Deploy
firebase deploy --only firestore:rules,firestore:indexes,storage  # Rules/indexes
firebase deploy --only functions                                    # Functions
```

For local Stripe webhook testing:
```bash
stripe listen --forward-to http://127.0.0.1:5001/<PROJECT_ID>/us-central1/stripeWebhook
```

## Architecture Overview

This is a two-sided marketplace (MCMP) where Artists create promotional campaigns for their music and Creators deliver social media content. Payments flow through Stripe (Checkout for escrow, Connect for creator payouts).

### Monorepo Structure

- **packages/shared/**: Shared TypeScript types (`types.ts`), constants (`constants.ts`), and JSON Schemas for AJV validation. Package name is `@mcmp/shared`. Used by both functions and web.
- **functions/**: Firebase Cloud Functions v2 (TypeScript). Entry point is `src/index.ts`.
- **packages/web/**: Next.js 14 App Router frontend. Routes in `app/`, components in `src/components/`, Firebase client utilities in `src/lib/`.

### Functions Organization (`functions/src/`)

| Directory | Purpose |
|-----------|---------|
| `callable/` | HTTPS callable functions (business logic for user actions) |
| `webhooks/` | HTTP endpoints (Stripe webhook handler) |
| `scheduled/` | Cron-triggered functions (auto-approve, expiry, payment cleanup) |
| `triggers/` | Firestore/Auth triggers (`authOnCreateUser`) |
| `utils/` | Shared utilities (auth, payout, pdf, signedUrl, stripe, validation) |
| `schemas/` | AJV request validation schemas |
| `shared/` | Constants and helpers specific to functions |

### Key Patterns

1. **Server-side enforcement**: All writes to Firestore are done via Cloud Functions. Firestore rules deny direct client writes for most collections (`allow write: if false`).

2. **Signed URLs**: Storage rules deny direct reads. Functions issue time-bound signed URLs for protected assets (track previews, evidence, contract PDFs).

3. **Request validation**: Callable functions validate payloads using AJV schemas from `packages/shared/src/schemas/requests/`.

4. **Escrow flow**: Artist pays via Stripe Checkout → webhook confirms payment → contract activates → creator delivers → artist approves → platform transfers to creator via Stripe Connect.

### Firestore Collections

Public profiles: `artistProfiles/{uid}`, `creatorProfiles/{uid}`
Private data: `artistPrivate/{uid}`, `creatorPrivate/{uid}`, `trackPrivate/{trackId}` (functions-only)
Core entities: `users`, `tracks`, `campaigns`, `offers`, `contracts`, `deliverables`
Messaging: `threads/{threadId}/messages/{messageId}`
Admin: `disputes`, `auditLogs`, `notifications`, `reviews`
Stripe: `stripeEvents`, `payoutTransfers`

### Web App Routes (`packages/web/app/`)

- `/artist/*` - Artist dashboard, tracks, campaigns, contracts
- `/creator/*` - Creator dashboard, marketplace, contracts, Stripe onboarding
- `/admin/*` - Admin verification queue, disputes
- `/messages/*` - Messaging threads
- `/onboarding` - Role selection after signup

## Coding Conventions

- TypeScript with `strict: true`. Explicit types at module boundaries.
- 2-space indentation. Keep files small and grouped by domain.
- camelCase for TypeScript modules in functions (e.g., `autoApproveDeliverables.ts`).
- Next.js routes follow framework conventions (`app/<route>/page.tsx`).
- Tests: Jest + ts-jest in `functions/src/**/__tests__/*.test.ts`. Use emulators, not live services.
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`.

## Environment Configuration

**Web** (`packages/web/.env.local`):
- `NEXT_PUBLIC_FIREBASE_*` - Firebase config values
- `NEXT_PUBLIC_USE_EMULATORS=true` - Connect to local emulators

**Functions** (`functions/.env.local` for emulators, Firebase secrets for prod):
- `APP_BASE_URL` - Base URL for links in emails/notifications
- `ADMIN_EMAIL_ALLOWLIST` - Comma-separated emails for auto-admin bootstrap
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe credentials
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` - Optional email sending

## Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |

## Node Version

Node.js 22.x (see `.nvmrc`)
