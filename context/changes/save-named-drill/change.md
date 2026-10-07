---
change_id: save-named-drill
title: Save a named drill configuration
status: impl_reviewed
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Roadmap S-10 (`context/foundation/roadmap.md`), PRD FR-010. Zalogowany użytkownik tworzy pod `/create` nazwaną konfigurację timera (bez kolorów faz) widoczną tylko dla niego.

- Tabela konfiguracji z `user_id` (FK `auth.users`, on delete cascade); unikalna nazwa per użytkownik; nazwa 1–200 znaków (check w bazie); limit 50 konfiguracji na użytkownika wymuszony w bazie; CHECK-i parametrów zgodne z walidacją timera z `src/lib`; timestamps.
- RLS z granularnymi politykami per operacja dla `authenticated` (`auth.uid() = user_id`); `anon` bez dostępu.
- Trasa `/create` chroniona middleware (gość -> `/auth/signin`); API z zod, `prerender = false`; błędy po angielsku.
- Brak tabeli na produkcji nie może psuć `/` ani innych tras gościa. Migracji na produkcję nie wykonujemy (`db push` robi koordynator przed merge).
- Poza zakresem: lista `/dashboard`, `/{id}`, edycja, usuwanie (S-11..S-13). Model danych musi je jednak obsłużyć.
