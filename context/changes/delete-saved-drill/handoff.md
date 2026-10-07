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
