# Plan review — open-saved-drill (S-11)

Reviewer: Claude (ręcznie; skill `/10x-plan-review` nie jest dostępny w tej sesji). Zakres: `plan.md`, `plan-brief.md`, S-10 handoff, `middleware.ts`, `protected-routes.ts`, `email-auth.ts`, `Layout.astro`, `drill-configurations.ts`, `scripts/smoke.mjs`, `wrangler.jsonc`, `eslint.config.js`. `plan.md` nie był edytowany.

Werdykt: plan jest spójny i dobrze ograniczony (brak migracji, RLS wystarcza, UUID guard przed bazą). Brak blokerów. 2 findings MEDIUM i 6 LOW/INFO do uwzględnienia przed implementacją.

## Findings

### F1 — MEDIUM — `Astro.rewrite("/404")`: nagłówki i status nie są gwarantowane
Plan ustawia `Cache-Control: private, no-store` w `[id].astro` "na każdej gałęzi", ale przy `Astro.rewrite` odpowiedź jest renderowana przez inną trasę. Nagłówki ustawione wcześniej na `Astro.response` nie muszą jej dotyczyć. Rewrite może też ponownie uruchomić middleware (drugi `createClient` i drugi `auth.getUser()` na jedno żądanie, wbrew lekcji F1 "jeden klient"). Status 404 przy rewrite do `/404` plan zostawia do sprawdzenia przez implementera.
Rekomendacja: wyodrębnić wspólny komponent treści 404 (np. `NotFoundView.astro`) i w `[id].astro` ustawić `Astro.response.status = 404` oraz nagłówki bezpośrednio, bez rewrite. `404.astro` używa tego samego komponentu i sam ustawia `no-store`. Identyczny markup jest wtedy zapewniony konstrukcyjnie. Jeśli zostaje rewrite: test w smoke na status, `Cache-Control` i brak różnic nagłówków między obcym a losowym UUID, oraz sprawdzenie, że middleware nie jest wykonywane dwa razy.

### F2 — MEDIUM — `[id].astro` polega wyłącznie na middleware
Plan nie przewiduje gałęzi `!locals.user` w `[id].astro`. Jeśli ścieżka obejdzie `isProtectedPath` (nietypowe kodowanie, przyszła zmiana), strona zapyta bazę jako `anon`. `anon` nie ma grantu, więc dostaniemy błąd (`42501`), który `classifyStoreError` mapuje na `unexpected`, czyli 503 zamiast przekierowania lub 404.
Rekomendacja: defense in depth. Brak `locals.user` oznacza redirect przez `signInUrlForProtectedPath`, zanim store zostanie dotknięty. Dodać test jednostkowy decyzji (funkcja w `src/lib`).

### F3 — LOW/MEDIUM — mapowanie błędów odczytu: "brak timerów" przy awarii
`classifyStoreError` zwraca dziś `unavailable` tylko dla `PGRST205`/`42P01`, a resztę jako `unexpected`. Plan mówi "nieznane błędy dają unavailable", co jest dobre, ale wymaga testów dla: `42501`/403 (brak grantu, `anon`), `data: null` bez `error` (musi dać `unavailable`, nie pustą listę), wyjątku z `list()` i `findById()` oraz błędu sieci. Pusta lista ("You have no saved timers yet.") ma być zwracana tylko dla `error === null && Array.isArray(data)`.
Dodatkowo: brak zdefiniowanego zachowania `dashboard.astro` dla `unauthorized` (plan opisuje tylko listę, pusty stan i alert). Rekomendacja: redirect do `/auth/signin?next=%2Fdashboard`, tak jak w `[id].astro`.

### F4 — LOW — smoke: "drugi użytkownik" to w istniejącym smoke ten sam użytkownik
W `scripts/smoke.mjs` ścieżka "existing-account" używa tego samego `email` co "new-account". Plan pisze "second user (second email-link session)", co bez zmiany da to samo konto i test własności będzie pozorny.
Rekomendacja: jawnie utworzyć drugi, odrębny adres e-mail (nowe konto) i sprawdzić, że `GET /{id pierwszego}` ma identyczny status i ciało jak `GET /{losowy UUID}`. Id zapisanego timera brać z odpowiedzi 201 z `POST /api/drills` i zapisać przed wylogowaniem pierwszego użytkownika. Krok `GET /{id}` pierwszego użytkownika wykonać też przed `verifyDrillLimit` albo po nim, pamiętając że po limicie ma on 50 wierszy.

### F5 — LOW — porównanie "identyczne ciało" 404
`Layout.astro` nie echo-uje URL-a (brak canonical/og:url), więc ciała 404 dla obcego i losowego UUID będą bajtowo identyczne. Warto to zapisać jako niezmiennik: `404.astro` nie może wypisywać `Astro.url`/`params.id`. Smoke porównuje wtedy surowe ciało i wybrane nagłówki (`status`, `cache-control`, `content-type`, `referrer-policy`), a nie tylko status. Różnica czasu między non-UUID (bez bazy) a UUID (jedno zapytanie) ujawnia wyłącznie poprawność formatu, nie istnienie, więc jest akceptowalna. Warto to jedno zdanie dodać do planu.

### F6 — LOW — 404.astro musi być SSR; Cloudflare `not_found_handling: "404-page"`
`wrangler.jsonc` ma `assets.not_found_handling = "404-page"`. Plan nie mówi, czy `404.astro` ma `export const prerender = false`. Statyczny `dist/404.html` nie dostałby nagłówków ani `Layout` z tematem. Rekomendacja: `prerender = false` w `404.astro` i `[id].astro`, oraz sprawdzenie na `npm run preview` (workerd), że `/abc` i `/abc/def` zwracają ten sam 404 z `no-store`.

### F7 — LOW — "refresh nie wznawia przebiegu" nazwane "tested property", a dowód jest tylko ręczny
Stan biegu jest w pamięci Reacta, a `node --test` nie renderuje Reacta. Kryterium 2.3 jest ręczne. Rekomendacja: albo przeformułować ("udokumentowana właściwość projektu, sprawdzona ręcznie i w fixture/smoke"), albo dodać do smoke asercję, że SSR HTML `/{id}` zawiera `Start`, a nie widok biegu. Warto też zanotować bfcache (Wstecz/Dalej może przywrócić stan w pamięci), w tym samym zachowaniu co `/` dziś.

### F8 — INFO — drobne uzupełnienia
- `isDrillId`/`isProtectedPath`: dodać przypadek `/{uuid}%2F` i `/{UUID wielkimi literami}`. Fallback `next` w `signInUrlForProtectedPath` dla ścieżki odrzuconej przez `isSafeNextPath` to `/dashboard`, więc `//{uuid}` wróci na dashboard, a nie do timera (akceptowalne, ale zapisać).
- pgTAP: dodać asercję `limit 50` + `order by created_at desc, id desc` jako kształt zapytania sklepu oraz wynik 0 wierszy dla `select ... where id = <cudzy>` jako `authenticated`. Zaktualizować `plan(N)` dokładnie (obecnie 70). Brak migracji (kryterium 1.3) jest spójne z kodem.
- Kolizje tras: `[id].astro` nie przesłania `/dashboard`, `/create`, `/auth/*`, `/api/*`, `/dev/*` (statyczne trasy mają priorytet). Pojedyncze segmenty bez własnej trasy (`/dev`, `/auth`, `/favicon.ico`) dostaną 404 przez `[id]`; zachowanie bez zmian dla użytkownika. `/dev/timer-ui` w produkcji nadal 404 (CI to sprawdza).
- UI: `SavedDrillList` jako `<ul>` z linkami-kartami (`min-w-0`, `break-words`), focus-visible na linku; `button.tsx` nie jest w lint-scope, ale jest współdzielonym prymitywem (OK). Dodać `noindex` do `/{id}` (strona za logowaniem).
- Kolejność faz poprawna (serwis i RLS, potem strony, potem dowody). Testowalność w `npm test` dobra dla `src/lib`; logikę saved-mode w `DrillApp` wyciągnąć do `src/lib` tylko jeśli powstanie jakaś decyzja do testowania.

## Zgodność z PRD/roadmapą
FR-011 ("lista jest stroną startową, na którą trafia po odświeżeniu") jest w roadmapie S-11 zinterpretowane jako `/dashboard`. Plan jest z tym zgodny; odświeżenie `/{id}` daje szczegóły tego timera, nie listę. Warto to potwierdzić z użytkownikiem jednym zdaniem w change.md.

## Decision: ACCEPTED

Coordinator accepted F1-F8; plan.md and plan-brief.md updated (shared NotFoundView with direct status/headers and no rewrite, !locals.user branch, read-error tests and dashboard unauthorized redirect, separate second account in smoke with raw body/header comparison, prerender = false, refresh/bfcache as an explicit manual point, {uuid}%2F and upper-case cases, exact pgTAP plan(N), noindex, ul). The plan is approved for implementation. Note on FR-011: /dashboard is the post-login start page; refreshing /{id} shows that timers details, not the list.
