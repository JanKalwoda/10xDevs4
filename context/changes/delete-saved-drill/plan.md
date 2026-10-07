# Delete a saved timer (S-13) Implementation Plan

## Overview

The owner deletes one of their saved timers from `/{id}`, but only after a confirmation dialog that shows the timer's name. The backend is `DELETE /api/drills/{id}`. This is the last item of the S-10…S-13 queue. Database: **no migration** (see Migration Notes).

## Current State Analysis

- `public.drill_configurations` already has `grant select, delete ... to authenticated` and the policy `drill_configurations_delete_own` (`supabase/migrations/20261007120000_create_drill_configurations.sql:100,119`). `user_id` cascades from `auth.users`. The limit trigger is INSERT-only, so a delete frees a slot by itself.
- `src/pages/api/drills/[id].ts` exports `PUT` and `ALL` → `methodNotAllowedResponse()` (405, `Allow: PUT`). The comment says DELETE is reserved for S-13.
- Service `src/lib/services/drill-configurations.ts`: `DrillConfigurationStore` (insert/list/findById/update), `isDrillId`, `normalizeDrillId`, `failure()`, `toResponse()`, `SAVE_DRILL_MESSAGES.not_found` (the single 404 text shared by page and API), `handleUpdateDrillRequest` order: 401 → 503 → 404 (bad id) → body checks → service.
- `SavedDrillDetails` has `data-slot="saved-drill-actions"` with `Edit timer`; the S-12 comment reserves the room for Delete. The page `[id].astro` renders `DrillApp savedDrill`; `/dashboard` lists the user's timers server-side with `no-store`.
- `src/components/ui` has no dialog primitive (alert, button, card, checkbox, input, label). The `radix-ui` package is already a dependency.
- pgTAP (`supabase/tests/database/drill_configurations.test.sql`, `plan(90)`) already checks that B's `delete ... where user_id = A` affects nothing (line ~139) and a delete at the limit (line ~451). It does not yet check delete-by-id of a foreign row with the row still present afterwards, sibling preservation, name reuse after delete or the freed limit slot as a flow.

### Key Discoveries:

- Foreign, missing and non-UUID ids must stay one identical 404 (AGENTS.md, S-12 `[id].ts`); the delete handler must reuse `failure("not_found", …)` so bodies and headers are byte-identical to PUT's 404.
- Cross-origin protection has three layers: (1) Astro 7 `checkOrigin` (`isForbiddenCrossOriginRequest`) answers 403 to an unsafe method without a matching `Origin`, so a DELETE with a foreign or missing `Origin` never reaches the handler (curl/Node clients must send the app `Origin`; `scripts/smoke.mjs` already does); (2) a DELETE is not a CORS-simple request and needs a preflight this app never approves (`ALL` → 405, no CORS headers); (3) `@supabase/ssr` cookies keep the default `SameSite=Lax`. No 415 for DELETE (there is no body to type); the handler ignores any body. Layer 1 is pinned by a scripted check, not by unit tests.
- `toResponse` is `Response.json(...)`, which throws for a 204 (null body status): success needs its own `new Response(null, { status: 204 })` path.
- Radix `AlertDialogAction` is a `Dialog.Close`: it closes the dialog right after `onClick` unless the event is `preventDefault`ed. `AlertDialogContent` ignores outside pointer events by design.
- `.delete().eq("id").eq("user_id").select("id").maybeSingle()` answers `null` for zero rows → a double delete is 404 without an error; this is the race handling.
- Timer UI contract (`npm run lint`, `timer-ui-contract.mjs`) covers timer components and entry routes; `src/components/ui` is shadcn territory but AGENTS.md forbids hardcoded colors. The shadcn `alert-dialog` overlay normally uses `bg-black/50`; it must be replaced with a token.

## Desired End State

On `/{id}` the owner sees a destructive outline `Delete timer` button next to `Edit timer`. It opens a modal alert dialog titled "Delete timer?" with the exact timer name and the sentence that this cannot be undone. `Cancel` has initial focus; Esc and Cancel close it without any request, and a click on the overlay does nothing (Radix `AlertDialog` is not dismissible by outside click, deliberately safer for a destructive action). `Delete` sends `DELETE /api/drills/{id}`; on 204 (or 404 — already gone) the browser goes to `/dashboard`, where the timer is absent. Errors keep the dialog open with an alert and a working retry. Verify: unit tests, pgTAP, scripted smoke, screenshots of the dialog states.

## What We're NOT Doing

- No Delete on the dashboard list (one place, minimal; the list stays links only). Recommended to the coordinator in [Q].
- No flash/toast message after the redirect and no undo/soft delete.
- No bulk delete, no trash, no migration, no `db reset`/`db push` (shared local stack).
- No change to Start, Edit, the timer controls or the visual gate of the seven timer states.
- No 415/body handling for DELETE.

## Implementation Approach

Mirror S-12: pure service + thin route first (with tests and pgTAP), then UI (shadcn `alert-dialog` through `npx shadcn@latest add alert-dialog`, token fix, a small controller + hook like `drill-create-controller`), then fixtures/smoke/screenshots/docs. Reuse `toResponse`, `failure`, `isDrillId`, `normalizeDrillId`, `classifyStoreError`.

Response contract of `DELETE /api/drills/{id}`: 401 `unauthorized` (no session) → 503 `unavailable` (no store) → 404 `not_found` (non-UUID, foreign, missing, already deleted; same body/headers as PUT) → 204 empty body on success; store failure → 503 for unavailable codes, 500 `unexpected` otherwise; every response `Cache-Control: no-store`. Only error codes are logged.

## Phase 1: Delete service, API and database tests

### Overview

Backend only; no UI.

### Changes Required:

#### 1. Store and service

**File**: `src/lib/services/drill-configurations.ts`

**Intent**: Add a delete operation to the store port and the Supabase adapter, a `deleteDrillConfiguration` service and a `handleDeleteDrillRequest` pipeline; update the 405 helper to allow DELETE. Success is a separate path from `toResponse` (which is `Response.json` and throws for 204).

**Contract**: `DrillConfigurationStore.delete(id, userId): PromiseLike<DeleteResult>` where `DeleteResult = { data: { id: string } | null; error: StoreError | null; status?: number }`; adapter `.delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle()`. `deleteDrillConfiguration(store, userId, id, log?)` returns a `HandlerResult`-compatible outcome; the id guard comes first, so a non-UUID id never reaches the store. `handleDeleteDrillRequest(request, { id, userId, store, log })` → `Response`: success is `new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })`; every error goes through `toResponse(failure(...))`. `methodNotAllowedResponse()` answers `Allow: PUT, DELETE`. Existing test fakes that implement the store get a `delete`.

#### 2. Route

**File**: `src/pages/api/drills/[id].ts`

**Intent**: Export `DELETE` next to `PUT`, with the same context wiring; `ALL` stays for the other methods.

**Contract**: `export const DELETE: APIRoute` (uppercase export, `prerender = false` already set). GET/POST/PATCH still 405.

#### 3. Tests

**File**: `src/lib/services/drill-delete.test.ts` (new); `drill-update.test.ts` and other store fakes (add `delete`).

**Intent**: Pin the contract.

**Contract**: 204 for own row; 401 without session (store untouched); 503 without store; foreign / random UUID / `not-a-uuid` / mixed-case UUID → byte-identical 404 (status, body, `cache-control`, `content-type`) and the non-UUID never calls the store; double delete (second call returns `data: null`) → 404; store `unavailable` (`PGRST205`) → 503, unknown error → 500 and only the code logged; success is status 204 with an empty body and `cache-control: no-store`; a request body or `Content-Type: text/plain` on DELETE is ignored (still 204) because there is nothing to type; the userId filter is passed to the store; 405 now has `Allow: PUT, DELETE` (update the existing 405 test).

#### 4. pgTAP

**File**: `supabase/tests/database/drill_configurations.test.sql`

**Intent**: Add DELETE-specific cases to the existing file and bump `plan(N)`; no new table, so no new file.

**Contract**: the statements mirror the adapter, `delete … returning id` (needs the SELECT policy and grant): B running `delete … where id = <A's row> returning id` → zero rows and A's row still exists by id (`reset role` check); A running it for an own row → exactly one row returned, A's siblings and B's rows untouched; after the delete, A can insert the same name (and the same name in other case) again; a user at the 50 limit can delete one row and then insert one (extends the existing limit test at ~:451; new is the "but not two" half); `anon` cannot delete (consistent with the existing anon tests). Use fresh fixed UUIDs not used by existing tests.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Types pass: `npx astro sync && npx astro check`
- Build passes: `npm run build`
- pgTAP passes on the shared stack without reset: `npx supabase test db`
- No migration added: `git diff --name-only main -- supabase/migrations` is empty
- Break-check: removing the `isDrillId` guard in `deleteDrillConfiguration` turns the non-UUID test red (revert afterwards)

#### Manual Verification:

- Scripted check on `npm run preview` with two throw-away users: own DELETE 204 (with the app `Origin`), repeat DELETE 404, foreign/random/non-UUID byte-identical 404, guest 401, GET/POST/PATCH 405 with `Allow: PUT, DELETE`, DELETE with a foreign `Origin` and without `Origin` → 403 and the timer still exists, other timers of both users untouched (record as scripted, not human; also confirms PostgREST `maybeSingle()` for zero rows on DELETE)

**Implementation Note**: pause for the human after automated checks pass.

---

## Phase 2: Confirmation dialog and Delete action

### Overview

The UI on `/{id}`: primitive, controller, dialog, action in the existing slot.

### Changes Required:

#### 1. Dialog primitive

**File**: `src/components/ui/alert-dialog.tsx` (via `npx shadcn@latest add alert-dialog`), `src/styles/global.css`

**Intent**: Add the missing shadcn primitive instead of hand-building a modal (focus trap, Esc, `role="alertdialog"`, aria labelling come from Radix). Replace any hardcoded overlay color (`bg-black/50`) with a new semantic token (e.g. `--overlay`, light and dark, registered in `@theme inline`).

**Contract**: exports `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`. Add `alert-dialog.tsx` to the timer-ui glob in `eslint.config.js` (`src/components/ui/{input,label,checkbox,card,alert,alert-dialog}.tsx`) and to the coverage assertion in `timer-ui-contract.test.mjs`, so the token fix is enforced. `--overlay` is defined in `:root` and `.dark` and mapped by `--color-overlay` in `@theme inline`. The `Delete` button uses tokens only: the destructive variant of `button.tsx` has `text-white` and `dark:bg-destructive/60` (dark `--destructive` is light, 0.74, with a dark `--destructive-foreground`), so either use `text-destructive-foreground` without the `/60`, or an outline button with `text-destructive`; measure contrast in light and dark. Do not change the look of other views: check first where `button.tsx` `destructive` is used, and report any change that reaches other views in the handoff.

#### 2. Controller and hook

**Files**: `src/lib/drill-delete-controller.ts` (+ `.test.ts`), `src/components/hooks/useDrillDelete.ts`

**Intent**: Pure, testable state machine like `drill-create-controller`: `idle | deleting | error`, with an injected `DeleteDrillPort` (`fetch DELETE`) and a `navigate` port.

**Contract**: `confirm()` while `deleting` is a no-op (double click sends one request); 204 or 404 → `navigate` port (production: `location.replace("/dashboard")`, so the deleted page leaves no history entry) and the state stays `deleting` (no flicker back); 401 → `error` with code `unauthorized` (alert has a sign-in link with `next=/{id}`); 5xx/network/unreadable body → `error` with the generic message and retry allowed; `cancel()`/dialog close is ignored while `deleting` (not dismissible mid-request) and resets `error` otherwise; `reset()` returns `deleting` to `idle`. The hook subscribes to `pageshow` and, when `event.persisted` (bfcache restore of a page that already navigated away), calls `reset()` and reloads, so the user never sees a stuck "Deleting…" dialog for a nonexistent timer. A 404 counts as done on status alone (a 404 from a proxy would redirect too; accepted). Tests cover each branch, including double confirm, 404-as-success and the `pageshow` reset.

#### 3. Delete component

**File**: `src/components/timer/DeleteDrillDialog.tsx` (new), used by `SavedDrillDetails.tsx`

**Intent**: Trigger via `AlertDialogTrigger asChild` around the `Delete timer` button (outline, destructive text via token), so Radix returns focus to it, and the dialog. Title "Delete timer?"; description: the quoted name, "will be permanently deleted. This cannot be undone." The name sits in a `break-words` element (names up to 200 chars, emoji); buttons `Cancel` (initial focus, Radix default on `AlertDialogCancel`) and `Delete`. The `Delete` `onClick` calls `event.preventDefault()` so Radix does not close the dialog before the result arrives; the dialog closes only through Cancel or Esc while the controller is not `deleting`, or by navigation. While pending `Delete` shows `Deleting…` with `aria-disabled` and a handler guard, not the `disabled` attribute, so focus stays inside the dialog; after an error focus moves to the alert or Cancel. Error alert uses the existing `Alert` (`role="alert"`). Focus returns to the trigger on Cancel/Esc.

**Contract**: props `{ drill: { id: string; name: string }; deleteDrill?: DeleteDrillPort; navigate?: (href: string) => void; defaultOpen?: boolean }` (ports default to production `fetch` and `location.replace`; the extra props let fixtures inject deterministic ports and force the dialog open); semantic tokens and the Tailwind scale only (timer contract). `SavedDrillDetails` puts it in `data-slot="saved-drill-actions"` after `Edit timer`; remove the "S-13 adds Delete here" comment.

### Success Criteria:

#### Automated Verification:

- Unit tests pass (controller): `npm test`
- Lint (timer UI contract incl. `SavedDrillDetails` and the dialog): `npm run lint`
- Contract rule tests pass and assert that `alert-dialog.tsx` is linted: `node --test scripts/eslint-rules/timer-ui-contract.test.mjs scripts/eslint-rules/account-entry-ui-contract.test.mjs`
- Types and build pass: `npx astro check` and `npm run build`
- Break-check: making `confirm()` re-entrant turns the double-confirm test red (revert afterwards)
- Playwright script (production preview, two throw-away users, results saved as `e2e-results.json`, recorded as scripted): after opening, `document.activeElement` is Cancel; Esc and Cancel send no request and focus returns to the trigger; a click on the overlay does not close and sends no request; after a forced 500 the dialog stays open and retry works; a double click sends one request; a 200-character name causes no horizontal scroll at 390 px; the dialog is named and described (`aria-labelledby`/`aria-describedby` with the name)

#### Manual Verification:

- Real browser on the production preview: dialog shows the exact name (long, emoji, NFD at 390 px without overflow), Cancel/Esc send no request and return focus to the trigger, a click on the overlay does nothing, Delete goes to `/dashboard` without the timer, Back after delete does not resurrect it or show a stuck dialog (page is `no-store`, `location.replace`, `pageshow`)
- Human confirmation of the scripted keyboard run and screen reader naming of the alertdialog; contrast of the `Delete` button in light and dark
- Timer deleted in another tab first: Delete here still ends on `/dashboard` (404 treated as done)

**Implementation Note**: pause for the human before Phase 3.

---

## Phase 3: Fixtures, smoke, screenshots and docs

### Overview

Visual gate, end-to-end evidence and documentation.

### Changes Required:

#### 1. Fixtures

**Files**: `src/components/timer/DeleteDrillFixtures.tsx` (new), `src/components/timer/SavedDrillFixtures.tsx`, `src/components/timer/TimerUiPreview.tsx`

**Intent**: Extend the production-backed `/dev/timer-ui` with the dialog states, reusing the production `DeleteDrillDialog` with injected ports (`deleteDrill`, `navigate`) and `defaultOpen`. One modal is open per scenario (a Radix modal portals, hides the rest of the page and traps focus), so the preview shows one dialog state at a time through a selector (state buttons or `?state=`; first check how `TimerUiPreview` already selects states and reuse it) and the screenshot script iterates the states.

**Contract**: states default (open), long name (200 chars) and emoji name, deleting (`aria-disabled` + `Deleting…`, port that never resolves), error (unavailable), unauthorized (sign-in link), plus the details card with the closed `Delete timer` trigger (always visible); hover/focus-visible/disabled on Delete and Cancel; empty is N/A (a dialog always has a name); light/dark at 1280 and 390 px. The seven timer-state gate and held-mounted lifecycle scenarios stay untouched.

#### 2. Smoke

**File**: `scripts/smoke.mjs`

**Intent**: Local mode steps: owner DELETE 204 and the timer gone from `/dashboard` and `/{id}` (404); repeat DELETE 404; second account's foreign/random/non-UUID DELETE identical 404 with the first account's timers unchanged; guest 401; name reusable after delete; a user at the 50 limit deletes one and saves one. Also: DELETE with a foreign `Origin` and without `Origin` → 403 with the timer intact, and with the app `Origin` → 204. Remote mode: guest DELETE 401 only. The shared stack has no Mailpit, so run a scratchpad copy that replaces only `waitForEmail`, as in S-12.

#### 3. Screenshots and docs

**Files**: `context/changes/delete-saved-drill/screenshots/` (+ README with the state table, `gate-results.json`), `AGENTS.md`, `README.md`, `context/changes/delete-saved-drill/handoff.md`

**Intent**: Save and review screenshots; document the delete dialog UI rule and fixtures in AGENTS.md; README: API line `DELETE`, `/{id}` row mentions Delete; handoff in the style of S-12.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, rule tests, `npx astro check`, `npm run build` pass
- `npx supabase test db` passes (no reset)
- Smoke (scratchpad copy, local mode) passes all steps (including the 403 origin steps) and the remote-mode script passes
- `/dev/timer-ui` answers 404 on the production preview
- Screenshots exist for the state matrix at 1280/390 in light/dark (one dialog state per capture), the gate script reports 0 failed checks and the `Delete` button contrast is measured in both themes

#### Manual Verification:

- Human review of the screenshots
- Final click-through in a real browser (bfcache Back after delete, real devices, screen reader)

---

## Testing Strategy

### Unit Tests:

- Service/handler: ownership, id guard, identical 404, double delete, 401/503/500 mapping, 405 `Allow`, body ignored
- Controller: single request on double confirm, 404-as-success, retry after error, not dismissible while deleting

### Integration Tests:

- pgTAP: foreign delete = 0 rows, sibling preservation, same name reusable, freed limit slot, anon denied
- Smoke script (above)

### Manual Testing Steps:

1. Delete a timer from `/{id}` with Cancel and Esc (the overlay is inert), then confirm; verify the dashboard
2. Delete the same timer from two tabs
3. Long/emoji/NFD names at 390 px; keyboard-only run

## Performance Considerations

One delete by primary key; nothing to optimize.

## Migration Notes

**No migration is needed**: the DELETE grant and the `delete_own` policy exist since the first migration and are covered by pgTAP. If implementation finds otherwise, stop and flag it. No `db push`, no `db reset`. Production needs no schema step before merge.

## References

- Roadmap: `context/foundation/roadmap.md` (S-13)
- Similar implementation: S-12 `context/changes/edit-saved-drill/handoff.md`, `src/lib/services/drill-configurations.ts:366-433`, `src/pages/api/drills/[id].ts`
- Details slot: `src/components/timer/SavedDrillDetails.tsx`
- RLS: `supabase/migrations/20261007120000_create_drill_configurations.sql:100-120`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete service, API and database tests

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 2a546c5
- [x] 1.2 Lint passes: `npm run lint` — 2a546c5
- [x] 1.3 Types pass: `npx astro sync && npx astro check` — 2a546c5
- [x] 1.4 Build passes: `npm run build` — 2a546c5
- [x] 1.5 pgTAP passes on the shared stack without reset: `npx supabase test db` — 2a546c5
- [x] 1.6 No migration added: `git diff --name-only main -- supabase/migrations` is empty — 2a546c5
- [x] 1.7 Break-check: removing the `isDrillId` guard in `deleteDrillConfiguration` turns the non-UUID test red (revert afterwards) — 2a546c5

#### Manual

- [ ] 1.8 Scripted check on `npm run preview` with two throw-away users (own 204 with app `Origin`, repeat 404, foreign/random/non-UUID identical 404, guest 401, 405 `Allow: PUT, DELETE`, foreign and missing `Origin` → 403, siblings untouched)

### Phase 2: Confirmation dialog and Delete action

#### Automated

- [x] 2.1 Unit tests pass (controller): `npm test` — 6a98799
- [x] 2.2 Lint (timer UI contract incl. `SavedDrillDetails` and the dialog): `npm run lint` — 6a98799
- [x] 2.3 Contract rule tests pass and assert that `alert-dialog.tsx` is linted — 6a98799
- [x] 2.4 Types and build pass: `npx astro check` and `npm run build` — 6a98799
- [x] 2.5 Break-check: making `confirm()` re-entrant turns the double-confirm test red (revert afterwards) — 6a98799
- [x] 2.9 Playwright script on the production preview (focus on Cancel, Esc/Cancel without request and focus back, overlay inert, dialog open after 500 and retry works, one request on double click, no horizontal scroll with a 200-character name at 390 px, aria name/description) — 6a98799 (scripted, not human)

#### Manual

- [ ] 2.6 Real browser: dialog shows the exact name (long, emoji, NFD at 390 px), Cancel/Esc send no request and return focus, overlay click does nothing, Delete goes to `/dashboard`, Back does not resurrect the timer or show a stuck dialog
- [ ] 2.7 Human confirmation of the keyboard run and screen reader naming of the alertdialog; Delete button contrast in light and dark
- [ ] 2.8 Timer deleted in another tab first: Delete still ends on `/dashboard`

### Phase 3: Fixtures, smoke, screenshots and docs

#### Automated

- [x] 3.1 `npm test`, `npm run lint`, rule tests, `npx astro check`, `npm run build` pass
- [x] 3.2 `npx supabase test db` passes (no reset)
- [x] 3.3 Smoke (scratchpad copy, local mode) passes all steps and the remote-mode script passes
- [x] 3.4 `/dev/timer-ui` answers 404 on the production preview
- [x] 3.5 Screenshots exist for the state matrix at 1280/390 in light/dark and the gate script reports 0 failed checks

#### Manual

- [ ] 3.6 Human review of the screenshots
- [ ] 3.7 Final click-through in a real browser (bfcache Back after delete, real devices, screen reader)
