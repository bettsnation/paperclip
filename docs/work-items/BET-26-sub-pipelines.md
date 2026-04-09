---
id: BET-26
title: "Add sub-pipelines — stage triggers another pipeline"
status: done
branch: wi/BET-26
target: feature/pipelines
date: 2026-04-09
---

# BET-26: Add sub-pipelines — stage triggers another pipeline

## Summary

New stage type `sub_pipeline` with a `subPipelineId` reference. When the engine
enters a sub_pipeline stage it creates a child pipeline run linked back to the
parent via `parentRunId`. The parent run waits at the sub_pipeline stage until
the child run completes, at which point the engine automatically advances the
parent to its next stage.

## Changes

### 1. Constants & validators (`packages/shared`)

- Added `"sub_pipeline"` to `PIPELINE_STAGE_TYPES` in `constants.ts`.
- Added `subPipelineId` (optional UUID) to the pipeline stage Zod schema in
  `validators/pipeline.ts` with a refinement ensuring it is required when
  `stageType` is `sub_pipeline`.
- Separated the base shape from the refinement so the update schema (`.partial()`)
  still works correctly.

### 2. Type definitions (`packages/shared`)

- `PipelineStage` interface: added `subPipelineId: string | null`.
- `PipelineRun` interface: added `parentRunId: string | null`.

### 3. Database schema & migration (`packages/db`)

- `pipelineStages` table: added `sub_pipeline_id` column (UUID, FK to `pipelines`).
- `pipelineRuns` table: added `parent_run_id` column (UUID) with index.
- Migration `0055_add_sub_pipelines.sql` adds the columns and constraints.

### 4. Pipeline engine (`server/src/services/issues.ts`)

- **Stage allowed statuses**: `sub_pipeline` allows `todo`, `in_progress`,
  `blocked`, `cancelled` — notably **not** `done`, preventing manual completion
  while a child run is active.
- **Default status**: `sub_pipeline` stages enter as `in_progress`.
- **`PipelineAction` interface**: added optional `createSubPipelineRun` field.
- **`resolveCompletion`**: when advancing to a `sub_pipeline` stage, populates
  `createSubPipelineRun` with the sub-pipeline ID and parent run reference.
- **`applyPipelineAction`**: creates the child pipeline run record, sets its
  `parentRunId`, and assigns the first sub-stage's agent to the issue.
- **Parent advancement on child completion**: when a run is marked `completed`
  and has a `parentRunId`, the engine finds the parent run, verifies it is
  waiting on a `sub_pipeline` stage, calls `resolveCompletion` for the parent,
  and applies all resulting side-effects (status override, agent reassignment,
  approval creation, nested sub-pipeline creation).
- **Auto-start**: if a pipeline's first stage is `sub_pipeline`, the auto-start
  logic on issue creation also creates the child pipeline run.

## Files Changed

- `packages/shared/src/constants.ts` — added `sub_pipeline` stage type
- `packages/shared/src/types/pipeline.ts` — added `subPipelineId`, `parentRunId`
- `packages/shared/src/validators/pipeline.ts` — added `subPipelineId` field + refinement
- `packages/db/src/schema/pipelines.ts` — added columns and index
- `packages/db/src/migrations/0055_add_sub_pipelines.sql` — migration
- `packages/db/src/migrations/meta/_journal.json` — journal entry
- `server/src/services/issues.ts` — engine logic for sub-pipelines
- `docs/work-items/BET-26-sub-pipelines.md` — this doc
