---
change_id: polish-timer-view
title: Dopracowanie widoku głównego timera
status: implementing
created: 2026-09-30
updated: 2026-10-01
archived_at: null
---

## Notes

S-15

## UI scope

- Jeden widok: główny timer pod `/`, obejmujący istniejącą konfigurację, przebieg, automatyczną pauzę i zakończenie.
- Źródło tokenów: `src/styles/global.css` — wartości w `:root` / `.dark`, publikacja w `@theme inline`.
- Wariant kontraktu: istniejący system projektowy Tailwind 4 + shadcn/ui; komponenty w `src/components/ui`. Timer korzysta z `Button`, ale jego własne kolory omijają tokeny.
- Podstawa audytu: istniejący `research.md`, uzupełniony o `## Charges` oraz skan plików widoku.
- Granice S-15: zachowanie istniejącego przebiegu i angielskiego UI; trzy sekcje faz, wybór kolorów, nowe sterowanie oraz zapis konfiguracji należą do osobnych przekrojów roadmapy.
