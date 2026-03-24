# Advanced Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AI scoring, admin controls, and Stripe payments without breaking current candidate/employer flows.

**Architecture:** Keep Firestore as the source of truth. Move sensitive logic (AI scoring, Stripe session creation, webhook processing) into Vercel serverless functions. The client reads from Firestore and calls serverless endpoints for privileged actions.

**Tech Stack:** Vercel Serverless, Firebase Auth/Firestore, Groq SDK, Stripe SDK, vanilla JS frontend.

---

### Task 1: Server-Side Apply Pipeline (AI Scoring)

**Files:**
- Modify: `api/apply.ts`
- Modify: `lib/appCheck.ts`
- Modify: `lib/ai.ts`
- Test: `tests/apply.test.mjs`

**Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFitScore } from '../lib/ai.js';

test('parseFitScore returns numeric score and explanation', () => {
  const result = parseFitScore('{"score": 77, "explanation": "Good fit"}');
  assert.equal(result.score, 77);
  assert.equal(result.explanation, 'Good fit');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/apply.test.mjs`
Expected: FAIL with "parseFitScore is not defined"

**Step 3: Write minimal implementation**

```ts
export function parseFitScore(content: string) {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.score !== 'number') throw new Error('Missing score');
    return { score: parsed.score, explanation: String(parsed.explanation || '') };
  } catch {
    return { score: 50, explanation: 'AI analysis failed.' };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/apply.test.mjs`
Expected: PASS

**Step 5: Implement endpoint changes**
- Allow App Check bypass when `process.env.ALLOW_NO_APP_CHECK === 'true'`.
- Add `employerId` and `companyName` to application docs.
- Use `parseFitScore` to avoid JSON parse crashes.

**Step 6: Commit**

```bash
git add api/apply.ts lib/appCheck.ts lib/ai.ts tests/apply.test.mjs
git commit -m "feat: add robust AI scoring pipeline"
```

---

### Task 2: Frontend Apply Flow (Use /api/apply)

**Files:**
- Modify: `public/script.js`
- Modify: `public/index.html`
- Modify: `public/styles.css`

**Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplyPayload } from '../public/script.helpers.js';

test('buildApplyPayload includes job and resume', () => {
  const payload = buildApplyPayload('job123', 'resume text', 'emp456');
  assert.equal(payload.jobId, 'job123');
  assert.equal(payload.employerId, 'emp456');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/apply-ui.test.mjs`
Expected: FAIL with "script.helpers.js not found"

**Step 3: Write minimal implementation**
- Extract a tiny helper `public/script.helpers.js` with `buildApplyPayload`.
- Update `public/script.js` to call `/api/apply` with Firebase ID token.
- Show fit score in candidate applications list.

**Step 4: Run test to verify it passes**

Run: `node --test tests/apply-ui.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add public/script.js public/index.html public/styles.css public/script.helpers.js tests/apply-ui.test.mjs
git commit -m "feat: wire apply flow to AI scoring endpoint"
```

---

### Task 3: Admin Controls (Roles + Job Moderation)

**Files:**
- Modify: `public/index.html`
- Modify: `public/script.js`
- Modify: `public/styles.css`
- Modify: `api/admin/set-role.ts`
- Test: `tests/admin.test.mjs`

**Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidRole } from '../lib/admin.js';

test('isValidRole accepts ADMIN/EMPLOYER/CANDIDATE', () => {
  assert.equal(isValidRole('ADMIN'), true);
  assert.equal(isValidRole('EMPLOYER'), true);
  assert.equal(isValidRole('CANDIDATE'), true);
  assert.equal(isValidRole('OTHER'), false);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/admin.test.mjs`
Expected: FAIL with "lib/admin.js not found"

**Step 3: Write minimal implementation**
- Add `lib/admin.ts` with `isValidRole`.
- Update admin API to write roles to Firestore (no custom claims).
- Add admin view in UI (list users, set roles, pause/unpause jobs).

**Step 4: Run test to verify it passes**

Run: `node --test tests/admin.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add public/index.html public/script.js public/styles.css api/admin/set-role.ts lib/admin.ts tests/admin.test.mjs
git commit -m "feat: add simple admin controls"
```

---

### Task 4: Payments (Stripe Checkout + Webhook)

**Files:**
- Modify: `package.json`
- Create: `api/payments/create-checkout.ts`
- Create: `api/payments/webhook.ts`
- Create: `lib/payments.ts`
- Modify: `firestore.rules`
- Test: `tests/payments.test.mjs`

**Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeUnlockPrice } from '../lib/payments.js';

test('computeUnlockPrice returns correct cents', () => {
  assert.equal(computeUnlockPrice('free'), 0);
  assert.equal(computeUnlockPrice('ppqa'), 1200);
  assert.equal(computeUnlockPrice('executive'), 25000);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/payments.test.mjs`
Expected: FAIL with "lib/payments.js not found"

**Step 3: Write minimal implementation**
- Add Stripe SDK dependency.
- Implement `computeUnlockPrice` in `lib/payments.ts`.
- Create checkout endpoint: validates employer ownership, creates Stripe session, writes `transactions` doc.
- Create webhook endpoint: marks transaction paid and updates application `unlocked: true`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/payments.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json api/payments/create-checkout.ts api/payments/webhook.ts lib/payments.ts firestore.rules tests/payments.test.mjs
git commit -m "feat: add Stripe checkout flow"
```

---

### Task 5: Employer Applications + Unlock UI

**Files:**
- Modify: `public/index.html`
- Modify: `public/script.js`
- Modify: `public/styles.css`

**Step 1: Write the failing test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatScore } from '../public/script.helpers.js';

test('formatScore formats integer scores', () => {
  assert.equal(formatScore(82), '82/100');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/employer-ui.test.mjs`
Expected: FAIL with "formatScore is not defined"

**Step 3: Write minimal implementation**
- Add employer applications list under employer dashboard.
- Show fit score, status, and unlock button.
- Unlock button calls `/api/payments/create-checkout` or unlocks instantly for free pricing.

**Step 4: Run test to verify it passes**

Run: `node --test tests/employer-ui.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add public/index.html public/script.js public/styles.css public/script.helpers.js tests/employer-ui.test.mjs
git commit -m "feat: add employer applications and unlock flow"
```

---

### Task 6: Smoke Test + Docs

**Files:**
- Modify: `docs/plans/2026-03-24-advanced-features-design.md`
- Modify: `docs/plans/2026-03-24-advanced-features.md`

**Step 1: Add smoke test checklist**
- Candidate: apply, see score, see application in list.
- Employer: post job, see applications, unlock candidate.
- Admin: change role, pause job.

**Step 2: Run smoke tests manually**
- Use the deployed preview to verify each flow.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-24-advanced-features-design.md docs/plans/2026-03-24-advanced-features.md
git commit -m "docs: add advanced features plan and smoke tests"
```

---

Plan complete and saved to `docs/plans/2026-03-24-advanced-features.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task with spec + quality review
2. Parallel Session (separate) - Use executing-plans in a new session

