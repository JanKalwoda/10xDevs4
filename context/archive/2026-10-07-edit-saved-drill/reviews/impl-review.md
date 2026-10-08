<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Edit Saved Drill (S-12)

- **Plan**: context/changes/edit-saved-drill/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-07
- **Verdict**: APPROVED
- **Resolution**: F1, F2, F4 fixed in one follow-up commit; F3 accepted as-is
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Checked and found correct

- `PUT /api/drills/{id}` (`src/pages/api/drills/[id].ts`, `handleUpdateDrillRequest`): order 401 → 503 → 404 (non-UUID, before the body is read) → 415 → 413 → 400 → service; `id`, `user_id`, `created_at` in the body → 400 (strict shape, tested); the id comes only from the path and is lower-cased; `Cache-Control: no-store`; only the error code is logged.
- `store.update`: `.update(six columns).eq("id").eq("user_id").select(SAVED_DRILL_COLUMNS).maybeSingle()`; `null` → 404, identical to a non-UUID id (byte-identical handler test and smoke step); 23505 + `drill_configurations_user_name_key` → 409 with `fieldErrors.name`; a limit error is mapped to `unexpected`.
- Database contract: no migration (`git diff main -- supabase/migrations` empty); pgTAP `plan(90)` covers zero rows for B by id with A's row unchanged, a different-case collision with another own row (23505), the same name as another user's row, sibling `updated_at` untouched, update at the 50-row limit. Case-only rename of the same row passes (pgTAP + smoke + unit).
- `/{id}/edit`: `SAVED_DRILL_PATH` accepts only `/{uuid}(/edit)?/?`; `/not-a-uuid/edit` is public and gives the same 404; the page mirrors `[id].astro` (`private, no-store`, `noindex`, 302 with `next=/{id}/edit`, 503 view, the id is not echoed).
- ESLint globs `src/pages/[[]id[]].astro` and `src/pages/[[]id[]]/edit.astro` plus a persistent test that the rule is enabled and reports a literal colour in both files.
- Generalized controller/hook/form: defaults keep the `/create` behavior (the 14 existing controller tests are unchanged and green); `markEdited`; the typed name and values stay after 409/400/404; `putSaveDrill` maps 409 → `duplicate_name`, 404 → `not_found`.
- `SavedDrillDetails`: `Edit timer` link in `saved-drill-actions`, no Delete code (S-13), Start stays primary. Semantic tokens, existing primitives only.

Gates run during this review: `npm test` 183/183, `npm run lint` clean, rule tests 5/5, `npx astro check` 0 errors (1 pre-existing hint), `npm run build` OK, `npx supabase test db` 90/90 PASS (shared stack, no reset).

## Findings

### F1 — Stale `Saved "…"` when parameters change during saving

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-create-controller.ts:98 (`markEdited`), src/components/timer/DrillEditApp.tsx:43
- **Detail**: Only the name field is `readOnly` while saving (`DrillCreateForm.tsx:70`); the parameter fields and the Random start checkbox in `DrillConfigForm` stay editable. `markEdited()` is a no-op while `status === "saving"`, so a parameter change made during the PUT is followed by `Saved "<name>".` although the form now shows values that were not saved. This contradicts the intent of review F2 ("`Saved "…"` never outlives a change of parameters"). The same latent window existed on `/create`, but there the success clears the form, so it matters mainly for edit.
- **Fix A ⭐ Recommended**: Remember an edit during saving in the controller (`markEdited` while saving sets a flag; on success with the flag set publish `idle` without `savedName`, or `saved` and then immediately `idle`).
  - Strength: Fixes it where the state lives, covered by the existing controller test style; no UI change for `/create`.
  - Tradeoff: One more piece of controller state and 1–2 tests.
  - Confidence: HIGH — the controller already owns the saved/idle transitions.
  - Blind spot: Whether the user should still get some success feedback in that case.
- **Fix B**: Make the parameter fields read-only while `pending` (like the name field).
  - Strength: Removes the window entirely, consistent with the name field.
  - Tradeoff: Touches `DrillConfigForm` shared with the run configuration and `/create`; needs fixture/screenshot updates.
  - Confidence: MED — `readOnly` on the checkbox needs a different mechanism (`disabled`).
  - Blind spot: Visual gate of the saving state for create and edit.
- **Decision**: ACCEPTED — Fix A (2026-10-07). `markEdited` while saving sets an `editedDuringSave` flag in the controller (`src/lib/drill-create-controller.ts`); when the reply arrives the flag is taken and reset, and the outcome is published as `idle` without `savedName` (success; the name still follows `keepAfterSave`) or without the alert (failure; a name error such as a duplicate stays). Three controller tests (success, failure incl. name error, no leak into the next save); break-check: with the flag never set the three tests go red. Tradeoff recorded: after an edit during saving the user gets no `Saved` confirmation for that request; the values on screen are still unsaved and the next `Save changes` persists them.

### F2 — `hover-*-1280` screenshots are byte-identical to `default-*-1280`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/edit-saved-drill/screenshots/hover-{light,dark}-1280.png
- **Detail**: `md5(hover-dark-1280.png) == md5(default-dark-1280.png)` and the same for light; the README says these show hover on `Save changes`. The scripted gate asserts the colour change, but the 1280 px visual evidence does not show the hover state (the 390 px files differ). Manual row 3.4 (screenshot review) is still unchecked.
- **Fix**: Re-capture `hover-*-1280` with the pointer kept over `Save changes` (and the button in the clip) and review them as part of 3.4.
- **Decision**: ACCEPTED (2026-10-07). `hover-{light,dark}-1280.png` re-captured with a real pointer (Playwright `hover()` on `Save changes`, `:hover` and the computed background asserted, tall viewport so nothing scrolls under the pointer) and no longer byte-identical to `default-*`. The other hover files (`hover-*-390`, `details-edit-hover-*`) already differed. Human review of the screenshots (3.4) is still open.

### F3 — Manual rows pending; 2.7–2.10 checked by a script, not a human

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/edit-saved-drill/plan.md (Progress)
- **Detail**: 1.7, 3.4, 3.5 are unchecked (honestly, a script did 1.7). 2.7–2.10 are `[x]` with "by Playwright script, not a human"; `lessons.md` says manual steps are marked done after the user confirms them. The repo smoke script itself (Mailpit path) has not yet run unchanged — only a scratchpad copy with GoTrue `generate_link`; CI will run it.
- **Fix**: Get the human click-through (3.5, incl. bfcache Back, emoji/NFD) and screenshot review (3.4) before merging; let CI's smoke job confirm the repo script.
- **Decision**: ACCEPTED-AS-IS (2026-10-07). Rows 1.7, 3.4, 3.5 and the human confirmation of 2.7–2.10 are done by the user at the end of the queue; CI runs the real smoke script with Mailpit.

### F4 — Other methods on `/api/drills/{id}` not verified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/pages/api/drills/[id].ts
- **Detail**: Plan 1.4 asks to verify that methods other than `PUT` get Astro's default response without ownership detail; neither the handoff nor the smoke records it (by construction no store access happens, so the risk is low).
- **Fix**: Add a smoke assertion that `GET`/`DELETE /api/drills/{own id}` and `/{random uuid}` give the same status and body.
- **Decision**: ACCEPTED (2026-10-07). `src/pages/api/drills/[id].ts` exports `ALL` next to `PUT` (Astro dispatches `mod[method] ?? mod.ALL`, so `PUT` wins): any other method gets a bodiless 405 with `Allow: PUT` and `Cache-Control: no-store`, built by `methodNotAllowedResponse()` (unit test in `drill-update.test.ts`). Without it Astro answered an empty 404. Verified against the production preview: `GET`/`POST`/`PATCH`/`DELETE` on a UUID → 405 + `Allow: PUT`. No session, id or store is read, so the answer is the same for own, foreign and random ids. DELETE is reserved for S-13 and is **not** implemented — 405 today; S-13 will add its own export.
