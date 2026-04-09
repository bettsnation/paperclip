---
id: BET-18
title: "Fix pipeline auto-start and Add Stage dialog crash"
status: done
branch: wi/BET-18
target: feature/pipelines
date: 2026-04-09
---

# BET-18: Fix pipeline auto-start and Add Stage dialog crash

## Changes

### 1. Pipeline auto-start on issue creation
In `server/src/services/issues.ts`, added logic to the `create()` method so that
when an issue is created in a project with an active pipeline:
- Queries for an active pipeline attached to the project
- Fetches pipeline stages ordered by `stageOrder`
- Creates a `pipeline_run` record with `status: "running"` and `currentStageId` set to the first stage
- Assigns the first stage's agent to the issue if no assignee was already set

This ensures `evaluatePipelineTransition()` can enforce status transitions from the moment the issue exists.

### 2. Add Stage dialog crash fix
In `ui/src/pages/PipelineDetail.tsx`, fixed the agent Select dropdown in the Add Stage dialog:
- Replaced empty string `value=""` on the "None" option with a sentinel value `"__none__"`
- Filtered out agents with empty/null IDs from the dropdown
- Updated placeholder text to "No agent (approval stage)"
- Mapped the sentinel value back to `null` when submitting the form

This resolves the Radix UI error: "A Select.Item must have a value prop that is not an empty string".

## Files Changed
- `server/src/services/issues.ts` — pipeline auto-start in `create()`, added `pipelines` import
- `ui/src/pages/PipelineDetail.tsx` — agent Select sentinel value fix
- `docs/work-items/BET-18-pipeline-autostart-and-dialog-fix.md` — this doc
