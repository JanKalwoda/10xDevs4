---
change_id: fix-double-tap-run-controls
title: Double click or tap runs Restart and Pause twice
status: implementing
created: 2026-10-15
updated: 2026-10-18
archived_at: null
---

## Notes

Potwierdzone w przeglądarce (testing-key-screen-layout, faza 2, `tests/e2e/key-screen-single-action.spec.ts`), w projektach `chromium` (dblclick) i `mobile-coarse` (dwa dotknięcia w jednym punkcie):

- Restart drill: podwójny klik/dotknięcie tworzy dwa nowe biegi (3 konteksty audio zamiast 2).
- Pause drill: podwójny klik/dotknięcie wstrzymuje i od razu wznawia bieg (bieg nie pozostaje w pauzie).

Start, Save timer i Delete confirm mają blokadę (jedna akcja). Testy z `test.fail()` wskazują tę zmianę; po naprawie usunąć `test.fail()`.

### Research (2026-10-18) — `research.md`

- **Mechanizm:** drugi klik trafia w nowy przycisk w tym samym miejscu. Restart: nowy `DrillTimer` z `key={identity}` ma świeży zatrzask, więc drugi klik to pierwszy Restart nowego biegu. Pause: `pause()` nie ma zatrzasku, a w slocie pojawia się Resume. Start jest odporny tylko przypadkowo (geometria).
- **`event.detail` nie wystarczy:** iOS Safari i emulacja dotyku w Chromium (projekt `mobile-coarse`) dają zawsze `1`. Dyskryminatorem musi być czas od poprzedniej akcji paska, trzymany u właściciela (`DrillApp`), bo Restart przemontowuje `DrillTimer`.
- **Kierunek:** krótka blokada wystawiona jako `aria-disabled="true"` (wzorzec repo); `locator.click()/tap()` czeka na Enabled, więc istniejące testy Pause→Resume (`run-audio-signals.spec.ts:86-87`, `key-screen-single-action.spec.ts:101-105`) nie wymagają `waitForTimeout`. Ciche ignorowanie by je zepsuło.
- **Decyzje dla planu:** długość okna (300 vs ~500 ms), odstępstwo od „Restart enabled during initialization” w CLAUDE.md, zakres (Start→Restart, Resume→Pause), zwolnienie klawiatury/AT (`detail === 0`); Cancel nigdy nie blokowany. Do potwierdzenia: czy `aria-disabled` na samym przycisku wstrzymuje akcję Playwright (dokumentacja mówi „descendant of”).
- **Źródła:** MDN `UIEvent.detail`, Leaflet#7012, mdn/browser-compat-data#30234, https://playwright.dev/docs/actionability (`context/docs/playwright.md`, zapytanie 5).
