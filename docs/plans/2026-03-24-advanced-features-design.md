# Advanced Features Design

**Goal:** Add AI scoring, admin controls, and payments while preserving the simple current UX and not breaking existing candidate/employer flows.

**Assumptions:** The app remains a static frontend with Firebase Auth + Firestore, and Vercel serverless functions are the backend for sensitive operations. Stripe keys will be provided later in the Vercel environment. We will not require Firebase App Check in development; production can enable it via an env toggle. If any assumption is wrong, I will adjust in the next pass.

## Architecture (Simple Hybrid)

The frontend continues to read public job listings directly from Firestore and writes user profile data under `/users/{uid}`. All privileged actions move to serverless functions to keep secrets off the client. AI scoring runs inside a Vercel function so the Groq key never leaves the server; that function writes the application document with `fitScore` and `aiReason`. Admin controls stay in the UI but operate on Firestore collections that rules already protect with the `role` field in the user profile. Payments are driven by Stripe Checkout sessions created server-side; the server writes a `transactions` document and the Stripe webhook finalizes the unlock. Firestore remains the source of truth, and the UI only reads its view state (applications, jobs, transactions). This keeps the architecture simple: one client, one DB, a few serverless endpoints for anything that requires secrets or verification.

## User Flows (Minimal Changes)

Candidates still browse jobs and apply from the same modal, but the apply action becomes a server call (`/api/apply`) that uses their Firebase ID token and returns a score. The UI shows the score in the application list for transparency. Employers keep the same dashboard and job posting screen; we add a simple applications list with a visible score, status, and an "Unlock" button. For paid plans, unlock opens a Stripe Checkout session. For free plans, unlock just reveals the candidate details and marks the application as unlocked. Admins get a hidden but clean admin view: list users, change roles, pause jobs, and view application stats. These changes preserve the current navigation and keep the UI minimal: no new pages for candidates, and a single admin panel for internal control. Error handling stays toast-based to avoid adding heavy UI state.
