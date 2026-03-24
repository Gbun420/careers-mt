---
name: extending-careers-mt
description: Use when extending the careers.mt app with new features, data flows, or backend logic while preserving a simple UX and secure boundaries
---

# Extending Careers.mt With Ownership

## Overview
The app stays simple when the client is thin, Firestore is the source of truth, and all secrets live in serverless endpoints. When told to take the lead, decide defaults and move forward without blocking questions.

**Core principle:** Preserve the existing UX while adding capabilities by pushing logic server-side and keeping Firestore schemas explicit.

## When to Use
- Adding AI scoring, admin controls, payments, or any privileged logic
- Changing application/job workflows or role handling
- You’re told to “take the lead,” “don’t ask questions,” or “ship fast”
- You must keep the UI minimal and avoid new pages

**Do NOT use when:**
- Building an unrelated project
- Doing pure UI polish with no backend changes

## Defaults (No Questions, Just Decide)
| Decision | Default | Rationale |
|---|---|---|
| Server-side logic | Vercel `api/` | Already in repo, simple deploy |
| AI scoring | `/api/apply` server-only | Keep Groq key off client |
| Payments | Stripe Checkout | Fewer UI states |
| App Check | Bypass in dev via env | Avoid blocking local dev |
| Admin roles | Firestore `/users/{uid}.role` | Client readable, rules enforce |

## Data Model (Must Match Rules)
**`jobs`**
- `employerId`, `companyName`, `title`, `location`, `type`, `salaryMin`, `salaryMax`, `pricing`, `budgetCap`, `status`, `createdAt`, `updatedAt`

**`applications`**
- `jobId`, `jobTitle`, `employerId`, `companyName`, `candidateId`, `resumeText`, `status`, `fitScore`, `aiReason`, `unlocked`, `createdAt`, `updatedAt`

**`users`**
- `role` in `['CANDIDATE','EMPLOYER','ADMIN']`

**`transactions`**
- `applicationId`, `employerId`, `amountCents`, `status`, `stripeSessionId`, `createdAt`

## Core Pattern (Keep It Simple)
1. **Decide defaults** (table above). Do not ask blocking questions.
2. **Define data fields** first (Firestorm doc shape + rules).
3. **Serverless for secrets** (Groq/Stripe only in `api/`).
4. **Client writes only safe docs** (jobs, applications from rules).
5. **UI changes are minimal** (reuse existing views, add small panels).
6. **Return to Firestore** (UI reads state, never trusts client claims).

## Security Boundaries
- Never ship API keys in `public/` or `firebase-config.js`.
- All AI scoring runs in `/api/apply` and writes `fitScore` + `aiReason` server-side.
- Payments always go through Stripe Checkout and webhook; client never marks `unlocked`.
- Roles are enforced by Firestore rules; client role is a display-only hint.

## Minimal Flows
**Candidate Apply**
- Client collects `resumeText` → calls `/api/apply` with Firebase ID token
- Server validates, scores, writes application doc
- Client shows score from Firestore

**Employer Unlock**
- Client creates Checkout session via `/api/payments/create-checkout`
- Webhook updates transaction and sets `applications.unlocked = true`
- UI reads unlock state, reveals details

**Admin Controls**
- Admin UI only manipulates `users.role` and `jobs.status`
- No new pages; simple list + dropdowns

## Example (Apply Endpoint Skeleton)
```ts
// api/apply.ts
const { jobId, resumeText } = applySchema.parse(req.body);
const job = await db.collection('jobs').doc(jobId).get();
const score = await calculateFitScore(resumeText, job.data()?.description || '');
await db.collection('applications').add({
  jobId,
  jobTitle: job.data()?.title || '',
  employerId: job.data()?.employerId || '',
  companyName: job.data()?.companyName || '',
  candidateId: userId,
  resumeText,
  fitScore: score.score,
  aiReason: score.explanation,
  status: 'applied',
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

## Common Mistakes
- Asking for a “single decision” instead of choosing defaults
- Putting Stripe/Groq keys in client code to “move fast”
- Adding new pages instead of extending existing sections
- Skipping Firestore schema updates and breaking rules

## Rationalization Table (Observed Failures)
| Excuse | Reality |
|---|---|
| “I need one binary choice to pick the fastest path.” | Defaults exist. Choose and proceed. |
| “One decision will drive the fastest path.” | You were told to take the lead. Decide. |

## Red Flags — STOP
- “I need to ask where server-side logic should live.”
- “Let’s mark unlock directly on the client.”
- “We should add a whole new dashboard page.”

**All of these mean:** stop, return to defaults, keep the UI minimal.

## Quick Reference
- Secrets → `api/`
- Roles → `/users/{uid}.role`
- Scoring → server-only
- Payments → Stripe Checkout + webhook
- UI → add small panels, never new pages
