# Take-Home Assignment — Project Backend Lead

## Why this assignment exists

We're not testing whether you can copy-paste SAML boilerplate. We're testing how you **think** when a requirement is shared, how you **own** a problem and your approach to solving the business problem.

This assignment intentionally leaves gaps. Finding them, calling them out, and making (and documenting) reasonable decisions is part of what's being evaluated — not a side quest.

**Time budget:** 4–6 hours total. We do not expect a production-grade system. We expect production-grade *thinking*, applied to a deliberately small surface area.

**AI tools:** Use them. Copilot, Claude, ChatGPT, whatever you normally reach for — this reflects how we actually work. What we care about is that you understand every line you ship and can defend every decision in the review call. We will ask "why," and "the AI suggested it" is not an answer.

---

## The scenario (as given to you — read this like a real ticket)

> "We need SSO for our platform. Set up Auth0 as our Identity Provider using SAML. Customers should be able to log in either by starting from Auth0's side or from our app's login page. Build the backend to handle this and a simple frontend so we can demo both flows. Should be straightforward, similar integrations exist online."

That's it. That's the whole ticket, deliberately.

A significant part of what we're evaluating is **what you do with a ticket like this before you write code.** Do you start scaffolding immediately, or do you interrogate the requirement first?

---

## What you're actually building

A minimal but correct SAML 2.0 SSO integration with the following properties:

1. **Auth0 configured as the SAML Identity Provider (IdP)** for a Service Provider (SP) app that you build.
2. **A Node.js backend** acting as the SAML Service Provider — handles metadata exchange, AssertionConsumerService (ACS) endpoint, and session issuance.
3. **A minimal frontend** (framework of your choice — plain HTML/JS is fine, React is fine) that gives a reviewer a clear, clickable way to exercise **both required login flows** below — not just backend routes working under the hood, but an actual UI path to trigger and observe each one:
   - **SP-initiated login** — a "Login with SSO" button/page that redirects to Auth0 and returns authenticated.
   - **IdP-initiated login** — a discoverable way to demo this (e.g. a documented Auth0 dashboard link, or an "IdP-initiated" demo entry point in your UI) where the user starts at the IdP and lands authenticated without visiting your login page first.
   - Shows the logged-in user's identity/claims from the SAML assertion after either login flow succeeds.
   - The UI should make it obvious *which* flow is being demonstrated at each step — we shouldn't have to guess from the URL bar. A one-line label per screen/button (e.g. "SP-initiated login") is enough.
4. **Session/identity handling** — no persistent database is required for this assignment. Hold the authenticated user's identity/session in memory or in a signed session token (your call) for the duration of the demo. If you want to note how you'd persist users (e.g. JIT provisioning into a real datastore) in a production version, put that in `DECISIONS.md` as a design note rather than building it.
5. A short **decision log** (see Deliverables) explaining what you built, what you assumed, and what you'd do differently with more time.
6. **Logout (both SP-initiated and IdP-initiated) is a stretch goal** — not required for a complete submission. See the "Stretch goals" section below for what we're looking for if you attempt it, and what we expect instead if you don't.

---

## Explicit requirements

### Auth0 / IdP setup
- Configure a SAML application in Auth0 acting as IdP for your SP.
- You decide the attribute mapping (email, name, etc.) — document what you chose and why.
- Provide the Auth0 tenant details / test credentials needed for us to log in and test both flows ourselves (a free Auth0 dev tenant is fine — do not use a paid/production tenant or real user data).

### Backend (Node.js)
- Implement SP-side SAML handling yourself using a library (e.g. `@node-saml/node-saml`, `passport-saml`, or similar) — do **not** hand-roll XML signature validation.
- Expose:
  - SP metadata endpoint
  - ACS (Assertion Consumer Service) endpoint that accepts both SP-initiated and IdP-initiated assertions
  - A session-protected endpoint that returns the current user's identity from their SAML assertion
- Validate the SAML response properly: signature validation, audience/recipient checks, and replay protection (e.g. don't accept the same `InResponseTo`/assertion ID twice). We will check this — a working demo that skips validation will score lower than a smaller demo that validates correctly.

### Frontend
- Minimal. This is not a design exercise. A working button and a page that shows "Logged in as: {email}" is sufficient.
- Must clearly demonstrate the *difference* between the two flows in the demo (e.g. two distinct entry points, or a short note/README walking us through how to trigger each one).

### Session strategy
- No database required — pick whatever session mechanism you like (in-memory store, signed cookie/JWT, etc.) and be ready to explain the choice.
- Be ready to explain how you'd key a user record if this *did* need to persist (e.g. by SAML `NameID`, email, or something else) — this is a discussion point for `DECISIONS.md`, not something you need to build.

### Code structure & repo hygiene

This is a lead-level hire, so we're also evaluating how you organize a project, not just whether it runs.

- Clear separation of concerns: SAML/SSO logic, session/auth middleware, and route handlers should not all live in one file.
- Sensible repo layout, e.g. something like:
  ```
  /backend
    /src
      /saml        # SP config, metadata, ACS handler, logout handler
      /auth        # session middleware, token/session helpers
      /routes
    server.js / index.js
  /frontend
    ...
  README.md
  DECISIONS.md
  ```
  (Adapt as you see fit — we're not grading against this exact tree, we're grading against "does this look like something a team could pick up and extend.")
- No secrets committed. Use `.env` + `.env.example`, and confirm `.env` is git-ignored.
- Reasonably small, meaningful commits with clear messages over the course of the assignment — a single "final commit" with everything squashed together makes it hard for us to see how you actually approached the problem, and we will look at commit history.
- Basic inline comments where the *why* isn't obvious (e.g. why you chose a particular replay-protection approach) — not comments restating what the code already says.

---

## Stretch goal: Logout (SP-initiated and IdP-initiated)

Logout is **not required** for a complete submission — SAML Single Logout is genuinely fiddly (notoriously so, even for experienced engineers) and we'd rather you spend your 4–6 hours getting login right than half-implementing logout under time pressure.

**If you have time left and want to attempt it:**
- SP-initiated logout: a "Logout" action in your app that terminates the local session and attempts to terminate the Auth0-side session too.
- IdP-initiated logout: a way to demonstrate that a logout triggered from Auth0's side is reflected in your app's session state.
- Full SLO protocol compliance is a bonus, not expected — a pragmatic shortcut (e.g. local session invalidation on redirect back from Auth0) is fine as long as you document what it does and doesn't cover.

**If you don't attempt it (which is completely fine):** we still want to see how you'd *think* about it. Before you submit, write up your approach to logout in `DECISIONS.md` even though you didn't build it — treat it as a mini design doc: how would SP-initiated vs. IdP-initiated logout differ, what's your source of truth for "logged out," what could go wrong (e.g. Auth0 session outlives your app session or vice versa), and roughly how you'd implement it given another few hours. We're evaluating the quality of that thinking the same way we'd evaluate working code — a sharp design note with no code can score as well as a rough implementation.

---

## Explicitly out of scope (don't burn time here)

- Production-grade key rotation / cert management
- Multi-tenant SAML (one IdP config is enough)
- Full RBAC/authorization system — authentication only
- Polished UI/UX
- SCIM provisioning
- Deployment/hosting (localhost + a `README` with run instructions is fine)

If you find yourself spending time here, that's a signal to stop and re-read the scenario — part of the evaluation is knowing what *not* to build in a 4–6 hour window.

---

## Deliverables

Publish your work to a **GitHub repository** (public, or private with `[reviewer-github-handle]` invited as a collaborator — either is fine, but it must be on GitHub with real commit history, not a zip file or a single-commit dump) containing:

1. **Code** — backend, frontend, and any setup scripts.
2. **`README.md`** with:
   - Setup/run instructions (assume a reviewer with a fresh machine)
   - Auth0 tenant access details needed for us to test (or a screen recording of both flows if you'd rather not share tenant access — either is fine)
   - How to trigger SP-initiated login (URL/button)
   - How to trigger IdP-initiated login (steps from Auth0 dashboard or a direct IdP-initiated URL)
   - If you attempted the logout stretch goal: how to trigger both logout paths
3. **`DECISIONS.md`** — the most important file in this submission. Should cover:
   - Questions you would have asked a PM/stakeholder, and what you assumed instead
   - Any part of the original ask you think is wrong, ambiguous, or incomplete — and what you'd change
   - Key design tradeoffs (e.g. session strategy, user-keying strategy, validation approach)
   - Where you used AI tools and for what (rough description is fine — e.g. "used Claude to scaffold the SAML metadata XML, hand-verified against Auth0's spec")
   - What you'd do differently or add first if given another day
   - Your approach to logout (SP- and IdP-initiated) — as working code if you attempted the stretch goal, or as a design write-up if you didn't (see "Stretch goal" section above)
4. **A short Loom/video walkthrough (5 min max)** demoing both required login flows end to end (plus logout, if you attempted it). This is the fastest way for us to evaluate without debugging your local environment.

---

## Evaluation rubric (what we're actually scoring)

| Area | What we're looking for |
|---|---|
| **Requirement handling** | Did you identify gaps in the ticket instead of building blindly? Are your assumptions documented and reasonable? |
| **Correctness of SAML implementation** | Does signature validation actually happen? Is replay protection real? Do both IdP- and SP-initiated flows genuinely work, not just one dressed up as both? |
| **Flow completeness in UI** | Can a reviewer, without reading code, click through and clearly observe both required flows — SP login and IdP login — and tell which is which? |
| **Logout thinking (stretch)** | If attempted: does it actually work for both directions? If not attempted: is the written approach in `DECISIONS.md` specific and correct, or hand-wavy? |
| **Code structure & repo hygiene** | Is logic separated sensibly (SAML, session, data access, routes)? Is commit history real and incremental? No secrets committed? |
| **System design instinct** | User-keying strategy, session model, JIT provisioning approach — are these defensible at a level beyond "it worked in my test"? |
| **Ownership** | Is the whole thing coherent end to end (Auth0 config → backend → frontend), or does it feel like disconnected pieces stitched together at the last minute? |
| **Judgment on scope** | Did you spend your 4–6 hours on the parts that mattered, or polish the wrong things? |
| **Communication** | Is `DECISIONS.md` something a teammate could actually read and understand your reasoning from, six months from now? |
| **AI usage** | Not scored as "used AI = bad." Scored on whether you understand and can defend everything you shipped, regardless of how it was produced. |

We are explicitly **not** scoring: frontend polish, test coverage percentage, or whether you used our exact preferred library.

---


