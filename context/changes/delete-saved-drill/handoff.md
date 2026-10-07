# Handoff — delete-saved-drill (S-13)

Worktree `D:\Dev\10xDevs4-delete-saved-drill`, branch `feature/delete-saved-drill`. Plan reviewed (F1–F10 accepted and applied, `reviews/plan-review.md`). No migration, no `db push`, no `db reset`.

## Phase 1 — implemented: delete service, API, pgTAP

Delivered:

- `src/lib/services/drill-configurations.ts`
  - `DeleteResult` and `DrillConfigurationStore.delete(id, userId)`; the Supabase adapter sends `.delete().eq("id").eq("user_id").select("id").maybeSingle()` (`DELETE … RETURNING id`; zero rows is `data: null`).
  - `deleteDrillConfiguration` (id guard first, so a non-UUID id never reaches the store; `null` → `not_found`; `unauthorized` / `unavailable` mapped, everything else (including duplicate/limit shaped codes, which a DELETE cannot produce) → `unexpected`; only the error code is logged) returning `{ kind: "deleted" } | { kind: "failed"; result }`.
  - `handleDeleteDrillRequest` (401 → 503 → 404 bad id → store). Success is `new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })` (not `toResponse`, because `Response.json` throws for 204); errors go through `toResponse(failure(...))`, so the 404 is byte-identical to PUT's. The request body and content type are ignored.
  - `methodNotAllowedResponse()` → `Allow: PUT, DELETE`.
- `src/pages/api/drills/[id].ts`: `DELETE` export next to `PUT`; `ALL` still answers 405 for the rest.
- Tests: `src/lib/services/drill-delete.test.ts` (new, 8 tests: 204 + empty body + no-store + lower-cased id, body/content type ignored, byte-identical 404 for foreign / missing / already deleted / non-UUID / braces / trailing slash, handler order, id guard, double delete, error mapping and logging, throwing store); existing store fakes got `delete`; the 405 test expects `Allow: PUT, DELETE`. `npm test` 195/195.
- pgTAP `plan(105)` (+15): B `delete … where id = <A's row> returning id` → empty and the row still exists; A deleting an own row by id returns the row, the second delete is empty, siblings and B's row untouched; the name (and the same name in another case) can be reused; `anon` cannot delete (42501); a user at the 50-row limit deletes one row, a two-row insert is still rejected (54000), one insert refills to exactly 50.

Gates (local, worktree): `npm test` 195/195; `npm run lint` clean; `npx astro sync && npx astro check` 0 errors (1 pre-existing hint); `npm run build` OK; `npx supabase test db` 105/105 PASS on the shared stack (no reset); `git diff --name-only main -- supabase/migrations` empty.

Break-check: replacing the `isDrillId` guard in `deleteDrillConfiguration` with a constant false turned "a non-UUID id never reaches the store" red (1 failure); restored with `git checkout`, green again.

Row 1.8 was executed **by a script, not a human** (`npm run preview` on port 4399, two throw-away users created through GoTrue admin with a password grant and a hand-built `@supabase/ssr` session cookie, deleted afterwards; the script lived in the scratchpad, 17 checks, 0 failed): foreign, random and non-UUID ids → byte-identical 404 (status, body, `cache-control`, `content-type`), foreign id not echoed, nothing deleted; guest 401 (and 403 with a foreign Origin); owner session with a foreign `Origin` and without `Origin` → 403 and the timer intact (Astro `checkOrigin`, layer 1 of the CSRF note); own DELETE with the app `Origin` → 204, empty body, `no-store`; `/{id}` then 404 and the dashboard no longer lists it but still lists the sibling; repeat DELETE → the same 404 as a foreign id (so PostgREST `maybeSingle()` answers `null` for zero rows on DELETE); the other timers of both users intact; the deleted name saved again (201); GET/POST/PATCH → 405 `Allow: PUT, DELETE`. Row 1.8 is therefore left unchecked for a human.

Notes for Phase 2:

- The worktree needed `npm ci` and a copy of `.env` / `.dev.vars` from the main checkout (both gitignored).
- Files in the repo are LF; edit them without a CRLF-converting tool.
- `eslint.config.js` timer-ui glob at line ~113 still lists `src/components/ui/{input,label,checkbox,card,alert}.tsx`; `alert-dialog.tsx` must be added (F5), together with the coverage assertion in `timer-ui-contract.test.mjs`.

## Phase 2 — implemented: confirmation dialog and Delete action (6a98799)

Delivered:

- `src/components/ui/alert-dialog.tsx` from `npx shadcn@latest add alert-dialog` (answered `n` to the `button.tsx` overwrite prompt; the first run also added a bogus `cn` npm dependency, reverted — `package.json` / lockfile are unchanged). Edits to the generated file: the registry imported `cn` from the `cn` package → `@/lib/utils`; overlay `bg-black/50` → `bg-overlay`; removed the unused `AlertDialogMedia` and the arbitrary-value centering/grid classes (`top-[50%]`, `max-w-[calc(…)]`, `grid-rows-[…]`) that the timer contract rejects (content is now `inset-x-4 top-1/2 mx-auto -translate-y-1/2`); `AlertDialogAction`/`Cancel` pass `className` to `Button` (not only to the inner Radix element), because Slot concatenates classes without tailwind-merge and `text-white` / `dark:bg-destructive/60` of the variant beat the overrides in dark mode (measured 2.54:1 before, 7.04:1 after).
- `--overlay` token (`oklch(0 0 0 / 0.5)` light, `/ 0.7` dark) + `--color-overlay` in `@theme inline`. `alert-dialog.tsx` added to the timer-ui glob in `eslint.config.js` and asserted in `timer-ui-contract.test.mjs` (rule tests 5/5).
- `src/lib/drill-delete-controller.ts` (+ `.test.ts`, 9 tests): `idle | deleting | error`, `confirm()` latch, 204/404 → `navigate("/dashboard")` and the state stays `deleting`, 401 → `unauthorized` (sign-in link `next=/{id}`), 503/network → `unavailable`, other/throwing port → `unexpected`; `cancel()` only clears an error, `reset()` for bfcache; `deleteDrillRequest(id)` production port. `src/components/hooks/useDrillDelete.ts` subscribes to `pageshow` (`persisted` → `reset()` + reload).
- `src/components/timer/DeleteDrillDialog.tsx`: props `{ drill, deleteDrill?, navigate?, defaultOpen? }`; outline trigger with `text-destructive`; `AlertDialogAction` (destructive variant, `text-destructive-foreground`, `dark:bg-destructive`) with `preventDefault`, `aria-disabled` + `Deleting…` while pending (no `disabled`); close ignored while deleting (Esc and Cancel); after an error focus goes to Cancel; long name in a `wrap-anywhere` span. Used in `SavedDrillDetails` after `Edit timer`; the S-13 comment removed.
- No change to `button.tsx`. `variant="destructive"` of `Button` was not used anywhere before (only `Alert` has a destructive variant), so no other view is affected.

Gates (worktree): `npm test` 204/204; `npm run lint` clean; rule tests 5/5; `astro check` 0 errors; `npm run build` OK; `npx supabase test db` 105/105 PASS (no reset); no migration. Break-check: dropping the `deleting` latch in `confirm()` turned the double-confirm test red (1 failure); restored, green.

Row 2.9 was executed **by a Playwright script, not a human** (`npm run preview` on 4399, one throw-away user deleted afterwards, `e2e-results.json`, 25 checks, 0 failed): alertdialog with `aria-labelledby` "Delete timer?" and `aria-describedby` containing the exact name; initial focus Cancel; Esc and Cancel send no request and focus returns to the trigger; overlay click does nothing; forced 500 keeps the dialog open with an alert and focus on Cancel, retry ends on `/dashboard` without the timer (sibling still listed); Back after delete shows no stuck dialog; double click sends one request and shows `Deleting…` with `aria-disabled`; timer deleted elsewhere first still ends on `/dashboard`; forced 401 shows a sign-in link with `next=/{id}`; 200-character and emoji/NFD names at 390 px keep the dialog inside the viewport with no inner overflow. Contrast measured from computed colours: confirm button 5.89:1 light / 7.04:1 dark; trigger text 5.49:1 / 7.04:1 on the page background.

Findings for the coordinator:

- **Pre-existing, not fixed (out of scope):** on `/{id}` a 200-character name without spaces makes the page itself scroll horizontally (`scrollWidth` 3432 at 390 px) even before the dialog opens — the header in `DrillApp` does not wrap long words. The dialog is fine. The 2.9 wording "no horizontal scroll" is therefore verified for the dialog only. A one-class fix (`wrap-anywhere`/`break-words` on the heading) would change a view outside this change; say if you want it in Phase 3.
- Preview/dist lock: `npm run build` fails with EPERM while `astro preview` runs from the same worktree; stop the preview first.
- Rows 2.6–2.8 stay open for a human.

## Phase 3 — implemented: fixtures, smoke, screenshots, docs

Delivered:

- **Fix of an S-11 bug (decision of the coordinator, outside the original S-13 scope):** a 200-character name without spaces made `/{id}` scroll horizontally (`scrollWidth` 3432 at 390 px) because the `DrillApp` header `h1` was a flex item with `break-words` and `min-width: auto`. The saved-timer heading now uses `SAVED_DRILL_HEADING_CLASS` (`min-w-0 … wrap-anywhere`, exported from `DrillApp.tsx`); the unnamed "Drill timer" heading and the rest of the layout are unchanged. Covered by the `page-long-name-*` fixture card (same class and header structure, the preview cannot mount `DrillApp` because its `ThemeToggle` overrides the `?theme=` class) and by a real-page script on the production preview (`e2e-long-heading.json`: 390 and 1280 px, no horizontal scroll, the whole name rendered).
- **Dark hover of the confirm button:** the gate found that `Delete` had no hover change in dark (`dark:bg-destructive` from Phase 2 beat the variant's `hover:bg-destructive/90`); added `dark:hover:bg-destructive/90` (contrast on hover 6.03:1 dark, 5.32:1 light).
- `src/components/timer/DeleteDrillFixtures.tsx` (new): production `DeleteDrillDialog` with injected ports, one open modal per scenario (a Radix modal hides and traps the page), chosen by buttons or `?delete=<state>` (read with `useSyncExternalStore`, so nothing opens by default and the other preview sections and their scripts stay reachable). States: default, long name (200 chars), emoji/NFD name, deleting (port never resolves), error (unavailable), unauthorized (sign-in link); deleting/error/unauthorized need `Delete` pressed (the gate script does it). Wired into `TimerUiPreview.tsx`.
- `SavedDrillDetails` takes an optional `deletePorts` (type `DeleteDrillDialogPorts`, exported from `DeleteDrillDialog.tsx`); the `saved-details` card in `SavedDrillFixtures.tsx` passes inert ports so the preview can never delete a real row, and shows the closed `Delete timer` trigger next to `Edit timer`.
- `scripts/smoke.mjs`: `originRequest` (DELETE with a foreign Origin / without Origin → 403 and the timer intact), `fillerIds`, `verifyOwnerDelete` (runs at the 50-timer limit: 405 `Allow: PUT, DELETE` for GET/POST/PATCH, 204 with an empty `no-store` body, `/{id}` 404 and gone from `/dashboard`, repeat / random / malformed DELETE byte-identical 404, a freed slot takes exactly one save and the deleted name is reusable, the other timers stay), `verifyForeignDelete` (second account, identical 404 and the same body as PUT's 404), `verifyGuestDelete` (401, also in remote mode).
- Screenshots and `gate-results.json` in `screenshots/` (README with the state table, contrast table and the S-11 fix evidence); `AGENTS.md` (Delete UI rule and fixtures), `README.md` (`/{id}` row, `DELETE` API line).

Gates (worktree): `npm test` 204/204; `npm run lint` clean; rule tests 5/5; `astro check` 0 errors; `npm run build` OK; `npx supabase test db` 105/105 PASS (no reset); no migration; production preview answers 404 on `/dev/timer-ui`. Smoke on the production preview (port 4323, shared stack without Mailpit) with a **scratchpad copy that replaces only `waitForEmail`** (GoTrue admin `generate_link` → a fake message with the callback link): all local steps passed, including the new delete steps and the 403 origin checks; remote mode passed (guest DELETE 401 included). Visual gate: 240 checks, 0 failed. Break-check: N/A for this phase (no new unit test; fixtures, smoke and docs only).

Scripted, not human: the smoke runs, the gate (`gate-results.json`) and the long-heading check (`e2e-long-heading.json`). Screenshots were reviewed by the agent (dialog error dark 390, long name light 390, long heading, focus ring on Delete dark 1280); the human review (3.6) and the final click-through (3.7) stay open.

Notes for the coordinator:

- The smoke cleanup removed every `smoke-*@example.com` GoTrue user on the shared stack (38, mostly leftovers of earlier runs).
- Full smoke with Mailpit runs in CI; this phase only proved the delete steps against the preview.
- Rows 1.8, 2.6–2.8, 3.6 and 3.7 stay unchecked for a human.

## Impl-review fixes (APPROVED, 0 critical)

Decisions in `reviews/impl-review.md`: F1 fixed (README ~164: POST/PUT need `application/json`; DELETE has no body and never answers 415), F2 fixed (`aria-disabled:pointer-events-none aria-disabled:opacity-50` on Cancel), F3 accepted as is (per plan). One commit; no migration, no `db push`/`db reset`. Next: PR to `main` (not merged by the agent).
