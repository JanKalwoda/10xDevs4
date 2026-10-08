# Signal preview icon — Plan Brief

> Full plan: `context/changes/signal-preview-icon/plan.md`

## What & Why

Odsłuch sygnału w formularzu ma być samą ikoną głośnika na końcu wiersza pola (Standby: przy Random start), a opis znaczenia i powód wyłączenia mają być w tooltipie (FR-004, FR-019). Dziś to pełnowymiarowy przycisk z trzema akapitami pod każdym polem, a wyłączony przycisk nie pokazuje powodu.

## Starting Point

`SignalPreviewControl.tsx` renderuje `Button` „Play … signal" pod polem i stały opis; `disabled` blokuje fokus i dotyk. Teksty znaczeń i powodów są gotowe w `drill-signal-preview.ts`. W `src/components/ui` nie ma `tooltip`.

## Desired End State

Wiersz `Input` + ikona `Volume2` (hitbox 44 px) z `aria-label`, `aria-disabled` i `aria-describedby`. Hover/fokus pokazują tooltip, dotyk odtwarza i pokazuje opis na ok. 4 s, wyłączona ikona pokazuje powód, błąd audio to widoczny `Alert` pod wierszem. Bez overflow przy 390 px.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Opis dla czytników | Stały element `sr-only` + ten sam tekst w tooltipie | Treść tooltipu nie istnieje w DOM, gdy zamknięty. | Plan |
| Dotyk | Sterowany `open` z timerem 4 s | Radix Tooltip nie otwiera się na dotyk. | Plan |
| Logika podpowiedzi | Czysty moduł `src/lib/signal-preview-hint.ts` z testami | `npm test` obejmuje tylko `src/lib`. | Plan |
| Wyłączenie | `aria-disabled` + zablokowany onClick | Wyłączona ikona musi przyjmować fokus i dotyk. | Plan |
| Hitbox | `size-11` (44 px) | Wygodny cel dotyku obok `Input`. | Plan |
| Błąd audio | `Alert` pod wierszem, nie w tooltipie | Wymaga widoczności bez hover. | Plan |
| Fazy | 3: tooltip + lint, wiersz z ikoną, fixtures/zrzuty/docs | Każda faza type-safe, osobny commit. | Plan |

## Scope

**In scope:** `tooltip.tsx` + lint, `SignalPreviewControl`, `DrillConfigForm`, moduł podpowiedzi + testy, fixtures, skrypt wizualny i zrzuty, jedno zdanie w `AGENTS.md`.

**Out of scope:** kontroler podglądu i audio, widok biegu, nowe tokeny, overflow 414 px w `TimerUiPreview`, archiwizacja.

## Architecture / Approach

Prezentacja zostaje w komponentach, decyzje o podpowiedzi (kiedy otwarta, co robi kliknięcie wyłączonej ikony) w czystym module. `ConfigField` dostaje opcjonalne `action` i `feedback`, więc pola bez podglądu się nie zmieniają.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tooltip pod lintem | `tooltip.tsx` + glob i test kontraktu | Klasy shadcn łamiące kontrakt tokenów |
| 2. Wiersz z ikoną | Ikona, tooltip, dotyk, `aria-disabled`, Alert | Dotyk i fokus w tooltipie Radix |
| 3. Fixtures i bramka | Stany, zrzuty 1280/390 light/dark, docs | Overflow i kontrast tooltipu |

**Prerequisites:** S-03 (scalone). **Estimated effort:** ~3 sesje, 3 fazy.

## Open Risks & Assumptions

- Założenia do potwierdzenia: hitbox 44 px, czas podpowiedzi 4 s, powód wyłączenia tylko w tooltipie (bez stałego tekstu pod polem).
- Tooltip w ciemnym motywie (`bg-foreground`) wymaga sprawdzenia kontrastu na zrzutach.

## Success Criteria (Summary)

- Odsłuch działa z ikony w każdym z trzech wierszy, opis i powód są w tooltipie, na dotyku po dotknięciu.
- Lint, testy, `astro check` i build zielone; zrzuty 7 stanów bez overflow.
