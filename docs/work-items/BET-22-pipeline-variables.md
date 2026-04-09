---
issue: BET-22
source_type: feature
components: [pipelines, issues, heartbeat]
tags: [pipeline-state, stage-variables, heartbeat-context]
files_changed:
  - packages/shared/src/validators/issue.ts
  - server/src/services/issues.ts
  - server/src/routes/issues.ts
date_completed: 2026-04-09
---

## Problem

Pipeline runs have a `stateJson` column that was never wired up. Agents completing
a pipeline stage had no way to pass structured data to the next stage, and the
heartbeat context did not expose any pipeline run information.

## Solution

Wire `pipelineState` end-to-end so agents can write arbitrary JSON that persists
across stages:

1. Accept `pipelineState` in `PATCH /issues/:id` via the update schema.
2. Merge caller-supplied state into `pipeline_runs.state_json` on every
   status transition (completion, rejection) and also when no status change
   occurs (so agents can write state mid-stage).
3. Include full pipeline context (run ID, current stage name/type, stateJson)
   in `GET /issues/:id/heartbeat-context` so agents receive accumulated state.
4. Include stateJson in the pipeline-reassignment wakeup payload so the next
   stage's agent has immediate access to prior-stage data.

## Changes Made

- `packages/shared/src/validators/issue.ts` — added `pipelineState: z.record(z.unknown()).optional()` to `updateIssueSchema`
- `server/src/services/issues.ts` — added `pipelineState` to update data type, extracted it before building patch, passed it to `evaluatePipelineTransition`, added merge-without-status-change path, added `currentStateJson` to `PipelineAction`
- `server/src/routes/issues.ts` — extracted `pipelineState` from req.body, passed to `svc.update`, added pipeline run + stage query to heartbeat-context endpoint, included `pipelineContext` in response, enriched pipeline reassignment wakeup with stateJson

## Verification

- `pnpm --filter @paperclipai/shared build` passes
- `pnpm --filter @paperclipai/server build` passes
- `npx tsc --noEmit` passes for UI

## Lessons Learned

- The `evaluatePipelineTransition` function only runs on actual status changes, so a separate code path is needed to persist pipelineState when the agent writes state without changing status.
- Pipeline run stateJson uses shallow merge semantics — later stages can overwrite keys set by earlier stages.
