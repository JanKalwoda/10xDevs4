---
starter_id: 10x-astro-starter
package_manager: npm
project_name: drill-me
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

DryFire Drill Timer to mała aplikacja webowa z terminem MVP wynoszącym dwa tygodnie pracy po godzinach. Wybrany przez autora 10x Astro Starter łączy TypeScript i React dla interaktywnego timera, Tailwind CSS 4 do stylowania interfejsu oraz Supabase, które zapewnia PostgreSQL i obsługę logowania potrzebne do zapisywania prywatnych konfiguracji. Wdrożenie na Cloudflare Pages odpowiada wybranemu celowi, a GitHub Actions ma automatycznie wdrażać zmiany po połączeniu z główną gałęzią. Starter spełnia cztery kryteria przyjazności agentom; tworzenie szkieletu ma poziom pewności first-class.
