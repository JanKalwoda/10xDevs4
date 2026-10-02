# Ocean Breeze theme implementation plan

## Overview

Apply the explicitly selected Ocean Breeze preset using the existing shadcn configuration. User authorization includes installation and verification.

## Current State Analysis

The public timer already uses semantic tokens, shared controls and a working light/dark toggle. Audit found zero hardcoded view values. The registry replaces values and extends typography/shadow mappings in global CSS, without adding components or dependencies.

## Desired End State

The timer displays Ocean Breeze in both modes, remains legible and keyboard accessible, and fits desktop/mobile widths. Raw upstream values and any accessibility adaptations are documented.

## Implementation Approach

Install through the supplied registry command, retain token roles, store provenance, and reuse the existing deterministic UI preview. No environment/library changes are needed beyond the installed registry style.

## Phase 1: Install and verify token theme

### Changes Required

**File**: src/styles/global.css

**Intent**: Install the preset and keep values in `:root` / `.dark` with variable-based role mappings in `@theme inline`.

**Contract**: Existing semantic names and dark toggle remain intact. Keep source attribution. If rendered text contrast fails, adjust only affected role tokens while preserving the Ocean Breeze palette and record the deviation.

**File**: AGENTS.md

**Intent**: Preserve the named theme through future work.

**Contract**: Extend the existing UI rule with the preset source and local provenance path; retain current component and lint contracts.

### Success Criteria

#### Automated Verification

- Registry installation and zero hardcoded view matches are verified.
- At 1280/390 px in light/dark, saved screenshots cover default, hover, focus-visible, disabled, error, loading; empty list is justified N/A. Browser checks confirm names, visible focus and no overflow; rendered active text passes contrast checks.
- Lint and production build pass.

#### Manual Verification

- User accepts the Ocean Breeze appearance using the preview or saved screenshots.

User acceptance (2026-10-02): the user confirmed that the Ocean Breeze appearance is accepted.

## Testing Strategy

Use native headless Edge/CDP and the existing fixtures without adding a browser test dependency. Review the saved images; run the existing lint/build checks. No logic changes or new unit tests are needed for token installation.

## References

- research.md
- ocean-breeze.json
- src/components/timer/TimerUiPreview.tsx

## Progress

### Phase 1: Install and verify token theme

#### Automated

- [x] 1.1 Registry installation and token contract verified — 395f43f
- [x] 1.2 Four theme/width combinations and seven states verified visually — 395f43f
- [x] 1.3 Lint and production build pass — 395f43f

#### Manual

- [x] 1.4 User accepts Ocean Breeze appearance
