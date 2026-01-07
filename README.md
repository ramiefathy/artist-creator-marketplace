# MCMP — Music-to-Creator Marketplace Platform (Firebase + Next.js)

This repository contains a complete MVP implementation of a two-sided marketplace where:

- **Artists** upload a track preview and create promotional campaigns.
- **Verified creators** browse live campaigns, listen to previews, and submit offers.
- Artists accept an offer, pay via **Stripe Checkout** (escrow-style), and the creator delivers content.
- Artists approve deliverables; the platform pays the creator via **Stripe Connect transfers**.

The system enforces key invariants server-side via Cloud Functions, and uses signed URLs for protected assets.

---

## What is included

### Core flows

1. **Auth + Role onboarding**
   - Email/password signup
   - Email verification gate
   - Onboarding role selection (artist / creator)
   - Optional admin bootstrap via allowlist

2. **Artist**
   - Upload preview MP3 + (optional) cover image
   - Create campaigns (budget, max price, desired deliverables, brief)
   - Publish campaigns to the creator marketplace
   - Review incoming offers and accept an offer
   - Pay escrow via Stripe Checkout
   - Review deliverables and approve / request revisions / reject
   - Access contract PDF and evidence assets via signed URLs

3. **Creator**
   - Edit creator profile
   - Request verification (uploads evidence)
   - Complete Stripe Connect onboarding (after verification)
   - Browse live campaigns and submit offers
   - View active contracts and submit deliverables (uploads evidence)
   - Messaging thread per offer/contract

4. **Admin**
   - Creator verification queue + approve/reject
   - Disputes queue + resolution (full/partial/no refund)
   - Access creator verification evidence via signed URLs

### Enforcement & automation

- **Escrow**: Artist payment is captured in Stripe Checkout; contract activates only after webhook confirms payment.
- **Auto-approve**: If an artist does not act within the review window, deliverables can be auto-approved (with safeguards).
- **Auto-refund on missed delivery**: Overdue deliverables may be auto-expired and auto-refunded (only if payout not sent).
- **Signed URLs**: Storage reads are denied by rules; the backend issues time-bound signed URLs to authorized parties.

---

## Tech stack

- **Frontend**: Next.js (App Router), Firebase Web SDK
- **Backend**: Firebase Cloud Functions (v2, TypeScript), Firestore, Firebase Auth, Cloud Storage
- **Payments**: Stripe Checkout (artist payments) + Stripe Connect Express (creator payouts)

---

## Repo structure

```
/
  functions/               # Cloud Functions (TypeScript)
  packages/web/            # Next.js app (App Router)
  firestore.rules          # Firestore security rules
  firestore.indexes.json   # Required composite indexes
  storage.rules            # Cloud Storage rules
  firebase.json            # Firebase config
  apphosting.yaml          # (Optional) Firebase App Hosting config
```

---

## Setup checklist

### 0) Prerequisites

- Node.js 22.x
- Firebase CLI (`npm i -g firebase-tools`)
- A Stripe account (test mode is fine for development)

---

### 1) Create and configure Firebase project

1. Create a Firebase project in the Firebase console.
2. Enable these products:
   - **Authentication** → Email/Password
   - **Firestore Database**
   - **Storage**
   - **Functions**
3. Create a **Web App** in Project Settings → Your apps.
   - Copy the web config values (apiKey, authDomain, projectId, ...).

---

### 2) Configure web environment variables

1. Copy `packages/web/.env.example` → `packages/web/.env.local`
2. Fill in Firebase values from your Firebase Web App settings.

For local emulator dev, set:

```bash
NEXT_PUBLIC_USE_EMULATORS=true
```

---

### 3) Configure Functions environment variables and secrets

#### Local emulator development

1. Copy `functions/.env.example` → `functions/.env.local`
2. Fill in:
   - `APP_BASE_URL` (e.g., `http://localhost:3000`)
   - `ADMIN_EMAIL_ALLOWLIST` (comma-separated emails) — include your own email for bootstrap admin
   - Stripe secrets (see next section)

#### Deployed (production/test) environment

Set Firebase Function **secrets** (required):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

Optional (email):

```bash
firebase functions:secrets:set SENDGRID_API_KEY
```

The remaining non-secret params (APP_BASE_URL, ADMIN_EMAIL_ALLOWLIST, SENDGRID_FROM_EMAIL) are defined using `defineString()`.
When you deploy functions, the CLI will prompt you for any missing values.

---

### 4) Stripe configuration

#### 4.1 Stripe API keys

In Stripe Dashboard (test mode recommended for development):

- Copy your **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`

#### 4.2 Webhook

This project exposes an HTTP webhook function named `stripeWebhook`.

You must configure Stripe to send at least these events:

- `checkout.session.completed`
- `checkout.session.expired`
- `charge.refunded`

For local development, you can forward Stripe webhooks to the Functions emulator using the Stripe CLI:

```bash
# In one terminal, ...
firebase emulators:start --only functions,firestore,auth,storage --project <YOUR_PROJECT_ID>

# In another terminal
stripe listen --forward-to http://127.0.0.1:5001/<YOUR_PROJECT_ID>/us-central1/stripeWebhook
```

The `stripe listen` command prints a webhook signing secret. Use that value as `STRIPE_WEBHOOK_SECRET` in `functions/.env.local`.

After deployment, you can retrieve the function URL from the Firebase console (Functions → `stripeWebhook`).

Set the webhook signing secret in Firebase as `STRIPE_WEBHOOK_SECRET`.

#### 4.3 Stripe Connect

Creators use **Stripe Connect Express accounts**.

Nothing special is required beyond enabling Connect in your Stripe account.
Creators will complete onboarding via the platform UI once they are verified.

---

## Local development (recommended first)

### 1) Install dependencies

From repo root:

```bash
npm install
```

### 2) Start Firebase emulators

```bash
firebase emulators:start --only auth,firestore,storage,functions
```

### 3) Start the web app

In another terminal:

```bash
cd packages/web
npm run dev
```

Open `http://localhost:3000`.

---

## Deployment

### Firestore rules / indexes / Storage rules

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### Functions

```bash
firebase deploy --only functions
```

### Web

You can deploy the Next.js app using:

- Firebase App Hosting (recommended if you are already on Firebase)
- Vercel
- Any Node-compatible hosting provider

If using Firebase App Hosting, configure environment variables in the App Hosting backend settings.

---

## Admin bootstrap

Admins are granted automatically when a user signs up with an email contained in `ADMIN_EMAIL_ALLOWLIST`.

Important:

- Set `ADMIN_EMAIL_ALLOWLIST` before creating your first admin user.
- If you forget, update the allowlist and create a new user with an allowed email.

---

## Notes and operational constraints

- This is an MVP; production hardening typically includes:
  - stronger fraud controls (creator verification, payment risk checks)
  - deeper rights management / takedown workflows
  - analytics attribution models beyond raw platform metrics
  - rate-limiting, anti-abuse, and monitoring

---

## Support

If something fails in a fresh setup, the most common causes are:

- Missing Stripe secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- Missing `packages/web/.env.local` Firebase config
- Firestore composite indexes not deployed yet
- Creator not verified / not onboarded to Stripe Connect
