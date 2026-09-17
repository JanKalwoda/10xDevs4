---
starter_id: 10x-astro-starter
package_manager: npm
project_name: dry-fire-drill-timer
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

DryFire Drill Timer to aplikacja webowa o małej skali, z budżetem dwóch tygodni pracy po godzinach. Wybrano ścieżkę standardową i zalecany dla JavaScript/TypeScript starter 10x Astro Starter: Astro, React, TypeScript, Tailwind CSS i Supabase. React zapewnia bazę interaktywnego timera, Tailwind CSS responsywnego interfejsu na telefony i komputery, a Supabase obsługi kont i prywatnych konfiguracji. Logowanie przez magic link, timer oraz zapis konfiguracji z kontrolą dostępu wymagają implementacji zgodnej z PRD; użytkownik zaakceptował dostosowanie logowania startera. Wdrożenie na Cloudflare Workers odpowiada aktualnej konfiguracji startera i skorygowanemu wpisowi lokalnego rejestru. GitHub Actions ma automatycznie wdrażać aplikację po scaleniu do głównej gałęzi. Przyjęto domyślny dla ścieżki standardowej zespół jednoosobowy. Ocena generowania szkieletu to first-class: starter jest zarejestrowany, lecz bootstrapowanie nie zostało zweryfikowane kompleksowo i może wymagać kroków ręcznych. Wybór stosu nie zastępuje weryfikacji wymagań dotyczących precyzji dźwięku, pauzy i zapobiegania wygaszaniu ekranu.
