---
change_id: testing-run-flow-form-behaviour
title: Testing run flow form behaviour
status: implemented
created: 2026-10-12
updated: 2026-10-12
archived_at: null
---

## Notes

### Research (2026-10-12)

- **Odpowiedź:** logika przebiegu, sygnałów i strzałek jest czystym TS w `src/lib` z portami (`DrillClock`, `random`, `DrillAudioPort`, `DrillVisibilityPort`); najtańsza warstwa z sygnałem dla #3 i #4 to test „run-level integration” w `node --test`: prawdziwy `DrillRun` + `buildPhaseSections` + `createDrillAudio` na fałszywym `AudioContext`, fałszywy zegar i skryptowany random. Bez nowych zależności.
- **Komponenty React (`.tsx`)** nie dają się uruchomić w `node --test` bez nowych zależności (DOM + loader JSX); okablowanie (Resume → `resumeWithAudio`, ukryta karta → `hide()`, audio w geście Start) zostaje do fazy 3 (decyzja koordynatora, Open Question 1 w `research.md`).
- **#6:** strona API, bazy i limitu jest już pokryta (faza 1, unit, pgTAP); w fazie 2 tylko kontrakt strzałki ↔ parser (strzałka ma własną kopię minimów i wzorca m:ss).
- **Słabe testy do wzmocnienia:** tolerancja `< 0.2` nie odróżnia oczekiwania liczonego od pierwszego i od drugiego dźwięku Standby, stały random nie dowodzi nowego losowania po wznowieniu, test lustrzany podglądu Next, czasy dźwięków skopiowane z implementacji.
- **Źródła:** PRD (US-01, US-02, FR-001–FR-006, FR-013, FR-018, FR-020, NFR), archiwum `2026-10-01-recover-timer-audio`, dokumentacja `context/docs/nodejs-test-runner.md` (Context7, `/websites/nodejs_latest-v24_x_api`).

