---
change_id: fix-double-tap-run-controls
title: Double click or tap runs Restart and Pause twice
status: new
created: 2026-10-15
updated: 2026-10-15
archived_at: null
---

## Notes

Potwierdzone w przeglądarce (testing-key-screen-layout, faza 2, `tests/e2e/key-screen-single-action.spec.ts`), w projektach `chromium` (dblclick) i `mobile-coarse` (dwa dotknięcia w jednym punkcie):

- Restart drill: podwójny klik/dotknięcie tworzy dwa nowe biegi (3 konteksty audio zamiast 2).
- Pause drill: podwójny klik/dotknięcie wstrzymuje i od razu wznawia bieg (bieg nie pozostaje w pauzie).

Start, Save timer i Delete confirm mają blokadę (jedna akcja). Testy z `test.fail()` wskazują tę zmianę; po naprawie usunąć `test.fail()`.
