---
change_id: testing-key-screen-layout
title: Key-screen layout and tap-target check (test-plan Phase 4)
status: impl_reviewed
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Key-screen layout and tap-target check". Risks covered: #7 (pole lub treść wychodzi poza ekran, przyciski zasłonięte, za małe albo nie reagują na klik/dotyk na kluczowych ekranach przy 1280 i 390 px) + cross-cutting domknięcie bramek CI (§5). Test types planned: e2e geometry checks, optional multimodal review, gates. Risk response intent: #7 — w obu szerokościach brak poziomego scrolla, każde pole i przycisk mieści się w oknie, główne przyciski (Start, Pause/Resume, Cancel, Restart, strzałki, Save, Delete) mają pole trafienia >= 44 px przy dotyku, nie są przykryte, a jedno kliknięcie wywołuje jedną akcję; deterministyczne pomiary geometrii w e2e (fine i coarse pointer), opcjonalnie przegląd multimodalny 1–2 ekranów; unikać snapshotu pikselowego każdej strony i modelu wizyjnego tam, gdzie wystarcza pomiar.

### Research (2026-10-15) — `research.md`

- **Overflow:** brak konstrukcji wymuszającej poziomy scroll; ręczna bramka S-22 zmierzyła 390 px bez overflow na widokach produkcyjnych, 1280 px na nich nie mierzono; nic z tego nie jest w CI.
- **≥ 44 px przy coarse:** spełnia pasek biegu (48), strzałki (44), głośnik, pola, karty listy; **Start, Save timer, Save changes, Edit timer, Delete timer i przyciski dialogu mają 36 px** (`button.tsx` `h-9`, bez `pointer-coarse:`) — test wg wyroczni będzie czerwony; decyzja w planie: poprawka UI w fazie albo osobna zmiana, nigdy osłabienie asercji.
- **Przykrycie:** niesprawdzane nigdzie; użyć `click/tap({ trial: true })` (actionability „Receives Events”) i `toBeInViewport({ ratio: 1 })`.
- **Jedno kliknięcie:** pojedynczy klik = jedna akcja; podwójny klik/tap daje dwie akcje dla Start, Restart, Pause (wnioskowanie z kodu) — decyzja, czy to część #7.
- **Bramki:** do podłączenia „layout i tap targets” (nowy projekt Playwright 390 + `hasTouch`/`isMobile` z `testMatch`, 1280 w `chromium`); ruleset `main` nie wymaga żadnych status checków (zmiana wymaga zgody); hook po edycji już podłączony (§5 → wired); README opisuje wyłączony pre-push.
- Źródła: `context/docs/playwright.md` (Context7 `/websites/playwright_dev`), skrypty bramek w `context/archive/2026-10-1{0,1}-ux-fixes-round-*/screenshots/`, `gh api` rulesets.

### Faza 2 (2026-10-15) — podwójny klik/dotknięcie

- Pomiar w przeglądarce (`key-screen-single-action.spec.ts`, projekty `chromium` i `mobile-coarse`): **Restart drill** przy podwójnym kliknięciu/dotknięciu tworzy dwa nowe biegi (3 konteksty audio zamiast 2); **Pause drill** pauzuje i od razu wznawia (bieg nie zostaje w pauzie). Start, Save timer i Delete confirm: jedna akcja.
- Oba testy mają `test.fail()` z odnośnikiem do nowej zmiany naprawczej `fix-double-tap-run-controls`.
