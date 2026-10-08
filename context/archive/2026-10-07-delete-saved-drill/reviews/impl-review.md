<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Delete a saved timer (S-13)

- **Plan**: context/changes/delete-saved-drill/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS (S-11 heading fix is a documented coordinator decision) |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (automated re-run: npm test 204/204, lint 0 errors, rule tests 5/5, astro check 0 errors, build OK, supabase test db 105/105; no migration/package change) |

## Findings

### F1 — README says both PUT and DELETE require Content-Type: application/json

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: README.md:164
- **Detail**: The API paragraph ends with "Both require `Content-Type: application/json`", which after adding DELETE is ambiguous/wrong: the plan states DELETE has no body, no 415, and the body/content type are ignored (drill-delete.test.ts pins it).
- **Fix**: Reword to "POST and PUT require `Content-Type: application/json`; DELETE has no body."
- **Decision**: ACCEPTED — fixed: README now says POST and PUT require `application/json`, DELETE has no body, ignores the content type and never answers 415.

### F2 — Cancel is aria-disabled while deleting but has no pointer/visual guard

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/timer/DeleteDrillDialog.tsx:95
- **Detail**: `AlertDialogCancel` gets `aria-disabled` but not the `aria-disabled:pointer-events-none aria-disabled:opacity-50` classes that Delete has. Behaviour is safe (onOpenChange ignores close while deleting), only the visual state is inconsistent with the announced state.
- **Fix**: Add the same aria-disabled classes to Cancel.
- **Decision**: ACCEPTED — fixed: Cancel got `aria-disabled:pointer-events-none aria-disabled:opacity-50` (no tokens or other views touched).

### F3 — 403 (Origin) and other non-mapped statuses show the generic message

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/drill-delete-controller.ts:101
- **Detail**: Only 204/404 (done), 401, 503 are mapped; 403/500/other → "unexpected" with retry. Acceptable and consistent with the plan; a proxy 404 is treated as done (accepted in plan). Noted only because a 404 on status alone could redirect after a non-app 404.
- **Fix**: None required (accepted in plan).
- **Decision**: ACCEPTED-AS-IS — as planned (403/500/other → generic "unexpected" with retry; a 404 counts as done).

## Verified without findings

- DELETE /api/drills/{id}: order 401 → 503 → 404(bad id) → store; 404 via the same `failure("not_found")` as PUT (byte-identical, tested incl. mixed-case/braces/trailing slash); 204 built outside `toResponse` with no-store; 405 `Allow: PUT, DELETE`; Origin 403 delegated to Astro checkOrigin and covered by smoke; only error codes logged.
- Store: `.delete().eq(id).eq(user_id).select("id").maybeSingle()`, 0 rows = null = 404 (double delete covered); RLS + grant unchanged, no migration; pgTAP covers foreign delete, siblings, name reuse, limit slot, anon.
- Dialog: preventDefault on Action, aria-disabled instead of disabled, close ignored while deleting (Esc/Cancel), focus to Cancel after error, Radix returns focus to trigger, name in wrap-anywhere span, location.replace, pageshow persisted → reset + reload, confirm latch synchronous.
- Tokens: `--overlay` in :root, .dark and @theme inline; no bg-black; alert-dialog.tsx in lint glob and rule test; destructive Button variant unused elsewhere so no other view changed; contrast 5.89/7.04 (confirm), hover 5.32/6.03.
- S-11 fix: `SAVED_DRILL_HEADING_CLASS` only affects the saved-timer heading; unnamed heading unchanged.
- Manual rows 1.8, 2.6–2.8, 3.6, 3.7 remain unchecked for a human (scripted evidence only).
