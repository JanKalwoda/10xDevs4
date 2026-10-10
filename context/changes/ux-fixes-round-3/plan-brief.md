# UX fixes round 3 — Plan Brief

> Full plan: `context/changes/ux-fixes-round-3/plan.md`

## What & Why

S-22 zbiera poprawki po ponownym teście S-21 (2026-10-11): strzałki steppera zmieniają wartość o 2 przy pojedynczym kliku/dotknięciu, mają być wbudowane w pole i układane wg głównego wskaźnika (laptop dotykowy dostaje układ komputerowy), tooltip odsłuchu na komputerze zostawia pustą prawą część, a okienko Current ma wrócić do wyglądu bez ramki i tła.

## Starting Point

`ConfigStepper` stepuje na `pointerdown` i tłumi następny `click` flagą kasowaną timerem 100 ms (wyścig); stepper stoi obok `Input` i przełącza układ przez `any-pointer-coarse:`; tooltip ma `max-w-xs`; Current i Next dzielą jedno pudełko z ramką i tłem.

## Desired End State

Jeden klik/tap = jeden krok (przytrzymanie powtarza po 400 ms); strzałki wewnątrz ramki pola (komputer: kolumna ▲▼ 2 × 22 px, telefon: ▼ ▲ po 44 px z separatorem; ikona głośnika poza polem); tooltip od `md` do `max-w-md`; Current bez ramki i tła, Next bez zmian.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Źródło kroku | Zawsze `click`; `pointerdown` tylko uzbraja powtarzanie po 400 ms | Jedno źródło kroku usuwa wyścig z timerem 100 ms | Użytkownik |
| Pominięcie kliku | Flaga po starcie powtarzania, kasowana przez `click`/nowy `pointerdown`/abort, nie timerem | Poprawność niezależna od czasu | Użytkownik |
| Układ | `pointer-coarse:` / domyślnie fine, nie `any-pointer-*` | Laptop dotykowy z myszą ma układ komputerowy | Użytkownik |
| Prymityw | shadcn `input-group` | Wspólna ramka i focus ring bez własnego CSS | Użytkownik |
| Tooltip | `md:max-w-md`, telefon bez zmian | Ograniczeniem jest szerokość, nie wskaźnik | Plan (do potwierdzenia) |
| Current | Bez ramki i tła, ta sama wysokość i padding co Next | Pasek przycisków nie skacze | Użytkownik |
| WCAG 2.5.8 | Wyjątek „Equivalent” (pole i ↑/↓) dla 22 px na głównym fine | Cel 22 px < 24 px | Plan |

## Scope

**In scope:** logika kroku + testy, stepper w `InputGroup`, tooltip, Current, fixtures, bramka Playwright, AGENTS.md/PRD/ux-fixes-plan/roadmapa.

**Out of scope:** `drill-stepper.ts`, API/baza, model run view, Next, tooltip na telefonie, nowe tokeny, archiwizacja.

## Architecture / Approach

Nowy czysty `drill-step-press.ts` (stan gestu: powtarzanie ruszyło → pomiń jeden `click`) nad rozszerzonym `drill-step-repeat.ts` (`arm`: pauza, potem krok i interwał); hook `useStepRepeat` i `ConfigStepper` tylko mapują zdarzenia. `ConfigField` używa `InputGroup` + `InputGroupInput` + `InputGroupAddon` ze `ConfigStepper`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Krok bez podwójnego kliku | Kontroler gestu + testy, szkielet skryptu | Kolejność zdarzeń pointerup/lostcapture/click |
| 2. Strzałki w polu | InputGroup, układ wg `pointer-coarse` | Overflow 390 px, wysokość wiersza |
| 3. Tooltip i Current | `md:max-w-md`, Current bez ramki | Równa wysokość z Next |
| 4. Fixtures, bramka, dokumentacja | 7 stanów × 3 setupy, docs, regresje S-18/S-19 | Nieaktualne asercje starych skryptów |

**Prerequisites:** S-21 zmergowane (jest na `main`).
**Estimated effort:** ~4 sesje (4 fazy).

## Open Risks & Assumptions

- Zgodność kolejności `pointerup` → `lostpointercapture` → `click` w Chromium/Safari (test w skrypcie i kontrolerze).
- `input-group` może dodać `textarea.tsx` jako zależność rejestru.
- Cel 22 px na głównym fine nadal opiera się na wyjątku WCAG „Equivalent”.

## Success Criteria (Summary)

- Jeden klik/tap zmienia o dokładnie 1 (także z opóźnionym `click`); laptop dotykowy ma układ pionowy.
- Strzałki w ramce pola bez overflow przy 390 px; tooltip bez luki; Current bez ramki i tła.
- Wszystkie kontrole i bramka wizualna zielone, dokumentacja zgodna.
