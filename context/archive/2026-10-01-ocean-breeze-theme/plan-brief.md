# Ocean Breeze — Plan Brief

Full plan: plan.md. Research: research.md.

## What & Why

Install the named Ocean Breeze registry preset requested by the user. Use the existing token and shared component system so the timer inherits the theme.

## Starting Point

The timer consumes semantic roles and has deterministic light/dark fixtures. The view audit found zero hardcoded color/dimension values.

## Desired End State

Ocean Breeze appears in light/dark at desktop/mobile widths, with readable text and keyboard focus. Source values and accessibility adaptations remain documented.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Preset | Ocean Breeze registry JSON | Explicit user selection | User |
| Values | Existing global token roles | Keeps components consistent | Research |
| Accessibility | Token adjustments where measured contrast fails | Preserves readable controls and errors | Plan |
| Visual gate | Existing development fixtures, native Edge | No added test dependency | Plan |

## Scope

One timer view plus global theme values and agent rules. No timer/audio logic change or component redesign.

## Architecture / Approach

Registry updates src/styles/global.css; raw JSON is stored beside the plan. Existing theme toggle and shared primitives consume the updated roles.

## Phases at a Glance

One phase installs and verifies the theme. No new library prerequisite; browser fallback applies to the preset's declared font stack.

## Open Risks & Assumptions

Global tokens also affect other consumers. Rendered timer contrast checks do not certify unused sidebar/chart roles.

## Success Criteria

Light/dark screenshots cover the seven-state matrix at 1280/390 px, text and focus stay readable, lint/build pass, and user visual acceptance remains explicit.
