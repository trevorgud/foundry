# Test Tooling Plan — Tiers 1 & 2

**Status: TBD — awaiting confirmation on the open questions in the [Decisions Needed](#decisions-needed) section.**

Detailed plan for the high-priority test tooling work tracked in [`roadmap.md`](./roadmap.md). Once the open questions are resolved, the plan can be sliced into discrete subtasks similar to the Phase 1/2/3 work.

## Why

The bugs shipped this session — `ChatMessage` schema validation on End Turn, `autoEndTurn` left `false` in the world DB by a test, HUD hidden behind the sidebar, pause behavior for non-GM users, partial player reset — share a common cause: the existing test suite drives the system entirely through the GM-side JavaScript API and never observes the browser. The rule engine and structured state are well-tested; the *playable surface* is not.

Tiers 1 and 2 close that gap with the minimum machinery needed to catch this category of bug in CI before it reaches a player.

## Goals

- Catch any uncaught browser exception or console error on the path of any existing test (Tier 1)
- Validate that a full game can be played end-to-end without manual intervention (Tier 1)
- Validate the *player* perspective — permissions, highlights, HUD identity, "your turn" notification — separately from the GM (Tier 2)
- Keep test runtime under ~3 minutes total

## Non-goals

- Pixel-perfect visual snapshots (deferred — Tier 3)
- Cross-version Foundry compatibility (deferred)
- Performance benchmarking (deferred)

---

## Tier 1 — Browser-side correctness through the GM session

### T1.1 — Page-error capture in shared fixture

**Status: TBD**

Add `page.on("pageerror", ...)` and `page.on("console", ...)` handlers to the existing test fixture so any uncaught error or `console.error` during test setup, the test body, or teardown fails the test.

- Capture both `pageerror` events (uncaught throws) and `console` messages with `type === "error"`
- Attach captured errors to the test report so they surface in CI output
- Need a small whitelist: Foundry itself logs benign warnings like `"Failed to parse URL from undefined"` — these should not fail tests

**Files touched:** `tests/foundry-smoke.spec.js` (add a `test.beforeEach` that attaches handlers, and an `afterEach` that asserts the captured-error list is empty modulo whitelist)

**Acceptance:** `make test-foundry` fails with a clear message if any browser error occurs during a test. Re-introducing the `ChatMessage` `type: 0` bug from this session reproduces a failure.

### T1.2 — Settings sanity test

**Status: TBD**

A new test that asserts world settings are in a sensible state after `resetBoard()`:

- `autoEndTurn === true`
- `whitePlayerId` resolves to a real `WhitePlayer` user
- `blackPlayerId` resolves to a real `BlackPlayer` user
- `autoSeed === true`

**Files touched:** `tests/foundry-smoke.spec.js` (one new test in the existing describe block)

**Acceptance:** A test that explicitly sets `autoEndTurn: false` and forgets to restore it would fail this check.

### T1.3 — Full-game simulation test

**Status: TBD**

A single test that plays a scripted ~6–10 turn scenario through the API and asserts the final state. The scenario should exercise:

- Move + attack within a single turn
- Auto-end-turn when no attack is available after a move
- Auto-skip turn when the incoming side has no legal actions
- King capture → game-over state set, further actions blocked

**Files touched:** `tests/foundry-smoke.spec.js` (one new test, ~50 lines)

**Acceptance:** The test passes end-to-end without calling `endTurn()` explicitly except for the auto-skip scenario it sets up. Action log contains the expected ordered entries.

---

## Tier 2 — Player perspective

### T2.1 — Multi-context player login helper

**Status: TBD**

Refactor `loginIfNeeded` from `tests/foundry-smoke.spec.js` (and the duplicate copy in `scripts/foundry-state.mjs`) into a shared helper that accepts a `userName` parameter. Default remains `"Gamemaster"` for backward compatibility.

**Files touched:** new `tests/helpers/foundry-login.mjs`; existing fixtures import from it.

**Acceptance:** Calling `loginAs(page, "WhitePlayer")` joins the world as that user. Existing GM tests still pass unchanged.

### T2.2 — Player-perspective test (single context)

**Status: TBD**

A test that opens a fresh browser context, logs in as `WhitePlayer`, and verifies:

- The `#pawn16-hud` element exists, contains "You: White", and is visible within the viewport
- Selecting a white pawn renders highlights on legal move squares (DOM check on the highlight container)
- Selecting a black pawn does not render highlights for that piece (since it's not the player's turn / piece)
- Calling `game.pawn16.endTurn()` succeeds without browser errors (catches the schema bug class)
- After end-turn, the HUD identity stays "You: White" but the active-side indicator no longer glows

**Files touched:** new `tests/foundry-player.spec.js`

**Acceptance:** Test runs in <30s, passes on green main, fails if any of the player-facing UX regresses.

### T2.3 — Two-player turn handoff (multi-context)

**Status: TBD**

A test that uses `browser.newContext()` twice — one as `WhitePlayer`, one as `BlackPlayer` — and exercises a turn handoff:

- White plays a move (auto-ends turn since no attack is available)
- Verify the Black context's HUD updates to show "Your turn — Black to move"
- Black plays a move
- Verify the White context's HUD updates accordingly

**Open question (see decisions):** how to coordinate state observation across contexts. Likely poll the HUD DOM with a timeout.

**Files touched:** `tests/foundry-player.spec.js`

**Acceptance:** Both contexts agree on the game state after each turn. "Your turn" notification text is observable in the receiving context.

### T2.4 — HUD positioning and identity check

**Status: TBD**

DOM-level assertions on the HUD element:

- `#pawn16-hud` exists after `canvasReady`
- `getBoundingClientRect()` is fully inside the viewport (would catch the `right: 320px` bug)
- For a player session, the HUD shows `"You: White"` or `"You: Black"`
- For the GM session, the identity line is omitted
- When it is the local player's turn, the inner element has the `pawn16-my-turn` class

**Files touched:** `tests/foundry-player.spec.js` (folded into T2.2/T2.3)

---

## Decisions needed

These need confirmation before slicing into subtasks. Where I have a default recommendation, it's marked.

### D1 — Strictness of the page-error whitelist
Foundry itself logs the warning `"Failed to parse URL from undefined"` on most page loads — it has no impact on gameplay. Should the whitelist be:

- **(A) Recommended)** Strict: explicitly list known-harmless message substrings (`"Failed to parse URL"`, etc.) and fail on anything else
- (B) Lenient: only fail on `pageerror` (uncaught throws), ignore `console.error` entirely
- (C) Severity-based: only fail on errors thrown from our system code (filter by stack frame containing `systems/pawn16/`)

### D2 — Test file layout
Existing tests live in `tests/foundry-smoke.spec.js`. As we add player-perspective tests, do we:

- **(A) Recommended)** Split: keep `foundry-smoke.spec.js` (GM/API), add `tests/foundry-player.spec.js` (multi-context, slower)
- (B) Single file: keep adding to `foundry-smoke.spec.js`
- (C) Three files: `foundry-rules.spec.js`, `foundry-game-flow.spec.js`, `foundry-player.spec.js`

### D3 — Game simulation: API or UI?
The full-game test (T1.3) can drive moves either through `game.pawn16.movePiece(...)` (existing API path) or by simulating UI interactions (toolbar clicks, drag, target+attack).

- **(A) Recommended)** API-only for T1.3; let T2.x cover UI interactions for the player perspective
- (B) Hybrid: half via API, half via UI clicks
- (C) UI-only: drive everything through Playwright clicks, including for T1.3

The recommendation reflects that T1.3 is about correctness of the *system* (rule engine + state), not the *UI*. UI assertions belong in T2.

### D4 — Multi-context coordination
Playwright supports multiple `BrowserContext` instances per test. Two contexts mean two simultaneous Foundry sessions. Open questions:

- Will Foundry v14 reliably support two authenticated user sessions on the same world simultaneously? (Should work — that's the entire point of multiplayer Foundry — but worth confirming on a real run before relying on it.)
- How do we synchronize across contexts? Recommended: poll the receiving context's HUD DOM with a Playwright `expect.poll(...)` block until the expected state appears, with a 5-second timeout.

**Decision needed:** confirm the polling approach is acceptable, or specify a stricter mechanism (e.g. socket listener instrumentation).

### D5 — Cleanup / state isolation
Currently `beforeEach` runs `resetBoard()`. World settings (like `autoEndTurn`) persist across tests because they're stored in the world DB.

- **(A) Recommended)** Add a `resetWorldSettings()` helper that re-applies defaults and call it from `beforeEach`. Keeps tests fully isolated.
- (B) Document the constraint in CLAUDE.md ("tests must restore any settings they change") and rely on T1.2 to catch leaks
- (C) Snapshot world settings before each test, restore after

### D6 — Are player credentials assumed or asserted?
The seeder auto-creates `WhitePlayer` and `BlackPlayer` with blank passwords. The multi-context tests rely on this.

- **(A) Recommended)** Tests assume the users exist (since the seeder runs on every GM `ready`); add an explicit `expect(game.users.getName("WhitePlayer")).toBeTruthy()` precondition at the start of each player test for fail-fast diagnostics
- (B) Tests create the users themselves if missing, ignoring the seeder

### D7 — Foundry container reuse vs fresh start
Each test currently runs against a long-running Foundry container. Settings/world data persist across runs. For multi-context tests this is mostly fine, but a flaky test could leave state corrupted.

- **(A) Recommended)** Keep the long-running container; rely on D5 to keep state clean
- (B) Add a `make test-foundry-clean` target that resets the world DB before running player tests

### D8 — Out-of-scope confirmation
Just to confirm what is NOT in this work item:

- Visual regression / pixel snapshots — deferred to Tier 3
- A `make play` CLI for headless full-game runs — deferred (`roadmap.md`, low priority)
- Performance / load tests — deferred
- Multi-version Foundry matrix — deferred

---

## Suggested execution order, post-approval

Once decisions are settled, suggest tackling in this order:

1. T1.1 (page-error capture) — biggest immediate win, lowest cost
2. T2.1 (login helper refactor) — unlocks T2.2/T2.3
3. T1.2 (settings sanity)
4. T2.2 (player single-context)
5. T1.3 (full-game simulation)
6. T2.3 (two-player handoff)
7. T2.4 (HUD checks) — folds into 4/6, may not be a separate commit

Phase commits at logical boundaries (T1 done, T2 done).

## Effort

Rough estimate: 1.5 days of focused work for everything in tier 1 + 2, assuming D1–D8 are settled before starting. Add ~0.5 day if multi-context turns out to need additional Playwright machinery.
