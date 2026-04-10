---
issue: BET-48
source_type: feature
components: [project-configuration, workspace]
tags: [ui, defaultRef, project-settings]
files_changed:
  - ui/src/components/ProjectProperties.tsx
date_completed: 2026-04-10
---

## Problem

The project workspace has a `defaultRef` field that controls which branch agents create worktrees from, but it was not exposed in the project Configuration UI. The only way to set it was via API.

## Solution

Added a "Default branch" input field in the Codebase section of project Configuration, following the same inline-edit pattern used by the existing Repo and Local folder fields.

## Changes Made

- `ui/src/components/ProjectProperties.tsx` — added "Default branch" row in the Codebase section that reads/writes `defaultRef` on the primary workspace. Shows current value or italic "auto-detect" placeholder. Edit mode uses the same input + Save/Cancel pattern as other codebase fields. Also extracted `resetWorkspaceForm()` helper to DRY up mutation onSuccess callbacks.

## Verification

- TypeScript typecheck passes across all packages
- Pre-existing test failures unrelated to this change (Routines.test.tsx `act` import issue)
- Vite build OOM-killed due to environment memory constraints, not code errors

## Lessons Learned

- The `codebase` object on `Project` is a computed view; actual persistence goes through `updateWorkspace` on the `primaryWorkspace`.
- `defaultRef` vs `repoRef`: `defaultRef` is the user-facing branch setting; `repoRef` is the repo checkout ref. Backend uses `defaultRef ?? repoRef` as fallback.
