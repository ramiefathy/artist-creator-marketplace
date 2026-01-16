# Repository Audit Report

**Date:** 2026-01-16
**Auditor:** Claude Code
**Repository:** artist-creator-marketplace

---

## Executive Summary

This audit covers security, architecture, dependencies, code quality, and testing for the artist-creator-marketplace monorepo. Overall, the codebase demonstrates **strong security practices** with a well-designed architecture.

| Area | Rating | Summary |
|------|--------|---------|
| **Security** | 8.5/10 | Strong server-side enforcement, proper auth/validation |
| **Architecture** | 9/10 | Clean monorepo structure, clear separation of concerns |
| **Dependencies** | 7/10 | Moderate vulnerabilities in Firebase/ESLint packages |
| **Code Quality** | 8/10 | TypeScript strict mode, consistent patterns |
| **Testing** | 7/10 | Integration tests present, could expand coverage |
| **CI/CD** | 6/10 | Basic build pipeline, missing tests in CI |

---

## 1. Architecture Overview

### Monorepo Structure
```
artist-creator-marketplace/
├── packages/
│   ├── shared/          # @mcmp/shared - Types, constants, AJV schemas
│   └── web/             # Next.js 14 App Router frontend
├── functions/           # Firebase Cloud Functions v2
├── firestore.rules      # Firestore security rules
├── storage.rules        # Cloud Storage security rules
└── firebase.json        # Firebase configuration
```

### Key Architectural Patterns

**Server-Side Enforcement Model** ✓ EXCELLENT
- All data mutations go through Cloud Functions
- Firestore rules deny direct client writes (`allow write: if false`)
- Storage rules deny direct reads; signed URLs issued by functions

**Request Validation** ✓ EXCELLENT
- AJV schema validation on all callable functions
- Strict TypeScript with explicit types at module boundaries
- Input sanitization with length/pattern constraints

**Authentication & Authorization** ✓ EXCELLENT
- Firebase Auth with custom claims for roles
- `requireAuth()`, `requireRole()`, `requireAdmin()` utilities
- Email verification enforced on sensitive operations

---

## 2. Security Findings

### 2.1 Critical Issues

#### CRITICAL: Storage Rules - Inconsistent Role Function
**File:** `storage.rules:6`
```javascript
// Current (VULNERABLE)
function role() { return signedIn() ? request.auth.token.role : 'unassigned'; }

// Fix (matches firestore.rules pattern)
function role() { return signedIn() ? request.auth.token.get('role', 'unassigned') : 'unassigned'; }
```
**Risk:** Direct access to `request.auth.token.role` returns `null` if custom claim is missing, causing role checks to fail unexpectedly.

#### CRITICAL: Dispute Evidence Upload Lacks Party Validation
**File:** `storage.rules:40-44`
```javascript
match /disputeEvidence/{contractId}/{uploaderUid}/{fileId} {
  allow write: if signedIn()
    && request.auth.uid == uploaderUid
    && request.resource.size < 10 * 1024 * 1024;
}
```
**Risk:** Any authenticated user can upload evidence to ANY dispute by knowing the `contractId`. Should validate uploader is a party to the contract.

**Recommended Fix:**
```javascript
allow write: if signedIn()
  && request.auth.uid == uploaderUid
  && exists(/databases/$(database)/documents/contracts/$(contractId))
  && (get(/databases/$(database)/documents/contracts/$(contractId)).data.artistUid == request.auth.uid
      || get(/databases/$(database)/documents/contracts/$(contractId)).data.creatorUid == request.auth.uid)
  && request.resource.size < 10 * 1024 * 1024;
```

#### HIGH: Deliverable Evidence Path Not Validated
**File:** `storage.rules:34-37`
```javascript
match /deliverableEvidence/{deliverableId}/{artistUid}/{creatorUid}/{fileId} {
  allow write: if signedIn() && isCreator() && request.auth.uid == creatorUid
    && request.resource.size < 10 * 1024 * 1024;
}
```
**Risk:** `artistUid` in path is not validated against the deliverable document. A creator could upload evidence with an incorrect artistUid.

### 2.2 Medium Issues

#### Stripe Error Details Exposed in Webhook Response
**File:** `functions/src/webhooks/stripeWebhook.ts:29`
```typescript
res.status(400).send(`Webhook signature verification failed: ${e?.message ?? 'unknown'}`);
```
**Risk:** May expose internal error details to attackers.
**Fix:** Log details server-side, return generic message to client.

#### Anonymous Auth Allowed for Large Social Uploads
**File:** `storage.rules:53-56`
- Comment explicitly states "including anonymous auth" is allowed
- Combined with 150 MB file size limit creates storage abuse risk
- **Recommendation:** Verify anonymous auth is intended; consider role restrictions.

### 2.3 Positive Security Findings

| Area | Status |
|------|--------|
| Authentication required | ✓ All callable functions |
| Role-based access control | ✓ Properly implemented |
| Input validation (AJV) | ✓ Comprehensive schemas |
| Stripe webhook signature verification | ✓ Implemented correctly |
| No hardcoded secrets | ✓ Firebase Secrets used |
| No XSS vulnerabilities | ✓ React auto-escaping |
| Transaction safety | ✓ Firestore transactions used |
| Rate limiting | ✓ Implemented on social actions |

---

## 3. Dependency Vulnerabilities

### npm audit Results

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `firebase` | Moderate | undici vulnerability | Upgrade to 10.14.1 |
| `eslint-config-next` | High | glob vulnerability | Upgrade to 16.1.2 (major) |

### Recommended Actions
```bash
# Functions package
cd functions && npm update firebase

# Web package - requires major version bump
cd packages/web && npm update eslint-config-next
```

### Current Versions vs Recommended
| Package | Current | Recommended |
|---------|---------|-------------|
| firebase (functions) | 10.12.5 | 10.14.1+ |
| firebase (web) | 10.12.5 | 10.14.1+ |
| eslint-config-next | 14.2.35 | 16.1.2 |
| next | 14.2.35 | Current OK |

---

## 4. Code Quality Analysis

### Strengths
- ✓ TypeScript `strict: true` throughout
- ✓ Consistent 2-space indentation
- ✓ camelCase naming conventions
- ✓ Logical grouping by domain (callable/, utils/, triggers/)
- ✓ Shared types prevent drift between packages
- ✓ ESLint configured for both functions and web

### Areas for Improvement

| Issue | Files | Recommendation |
|-------|-------|----------------|
| Large callable files | `social.ts` (21.7KB), `offers.ts` (17.8KB) | Consider splitting by sub-domain |
| Local type definitions | Each callable defines `type Req/Res` locally | Centralize in @mcmp/shared |
| Duplicate constants | `functions/src/shared/constants.ts` | Use @mcmp/shared exclusively |
| Console statements | Various files | Use structured logging service |

---

## 5. Testing & CI/CD

### Test Coverage

| Test Type | Count | Files |
|-----------|-------|-------|
| Unit tests | 6 | flags, handles, handleCooldown, media, rateLimit, socialVisibility, mediaAccess |
| Integration tests | 2 | blocksIntegration, mediaIntegration |
| Rules tests | 2 | firestoreRules, storageRules |

### CI/CD Configuration

**Current (`ci.yml`):**
- ✓ Runs on push and pull_request
- ✓ Builds all workspaces
- ✗ **Missing:** Test execution in CI
- ✗ **Missing:** Lint checks in CI
- ✗ **Missing:** Security audit in CI

### Recommended CI Improvements
```yaml
- name: Run tests
  run: npm test

- name: Run linting
  run: npm run lint --workspaces

- name: Security audit
  run: npm audit --audit-level=high
```

---

## 6. Recommendations Summary

### Priority 1 - Critical Security Fixes
1. **Fix storage.rules `role()` function** - Use `.get('role', 'unassigned')` pattern
2. **Add party validation to dispute evidence uploads** - Validate uploader is contract party
3. **Validate deliverable evidence paths** - Cross-reference with deliverable document

### Priority 2 - Security Improvements
4. Redact Stripe error messages in webhook responses
5. Review anonymous auth policy for social uploads
6. Add audit logging for admin actions

### Priority 3 - Dependency Updates
7. Upgrade firebase package to 10.14.1+
8. Upgrade eslint-config-next to 16.x (breaking change, test thoroughly)

### Priority 4 - CI/CD Enhancements
9. Add test execution to CI pipeline
10. Add lint checks to CI pipeline
11. Add npm audit to CI pipeline

### Priority 5 - Code Quality
12. Split large callable files (social.ts, offers.ts)
13. Centralize Req/Res types in @mcmp/shared
14. Replace console.error with structured logging

---

## 7. Files Requiring Attention

| File | Issue | Priority |
|------|-------|----------|
| `storage.rules:6` | Inconsistent role() function | CRITICAL |
| `storage.rules:40-44` | Dispute evidence validation | CRITICAL |
| `storage.rules:34-37` | Deliverable evidence validation | HIGH |
| `functions/src/webhooks/stripeWebhook.ts:29` | Error message exposure | MEDIUM |
| `.github/workflows/ci.yml` | Missing tests/lint/audit | MEDIUM |
| `functions/package.json` | Firebase version | LOW |
| `packages/web/package.json` | eslint-config-next version | LOW |

---

## Conclusion

The artist-creator-marketplace repository demonstrates **solid security practices** with its server-side enforcement model, comprehensive input validation, and proper authentication handling. The identified critical issues in storage rules should be addressed promptly, but overall the codebase is well-architected and maintainable.

**Overall Assessment: GOOD** - Ready for production with recommended fixes applied.
