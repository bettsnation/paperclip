---
id: BET-25
title: "Add parallel stages — same stageOrder must all complete"
status: in_review
branch: wi/BET-25
target: feature/pipelines
date: 2026-04-09
---

# BET-25: Add parallel stages — same stageOrder must all complete

## Overview

Pipeline stages with the same `stageOrder` now form a parallel group. All stages
in a group must complete before the pipeline advances to the next group. Each
parallel stage retains its own agent assignment. Within a group, stages are
completed sequentially (one agent at a time) with progress tracked in
`stateJson.completedStageIds`.

## Changes

### 1. Server — pipeline transition logic (`server/src/services/issues.ts`)

Added helper functions for parallel-group semantics:

- **`groupStagesByOrder()`** — groups stages by `stageOrder`, returns ordered
  arrays of arrays
- **`getCompletedStageIds()`** — reads completed stage IDs from
  `pipelineRun.stateJson.completedStageIds`
- **`withCompletedStage()`** — returns updated `stateJson` with a newly completed
  stage ID added
- **`buildAdvanceAction()`** — builds the `PipelineAction` for advancing to a
  given next stage (handles approval auto-creation)

Rewrote **`resolveCompletion()`**:
- When a stage completes, marks it in `stateJson.completedStageIds`
- Checks if all stages in the current parallel group are done
- If not all done, advances to the next unfinished stage in the same group
- If all done, advances to the first stage of the next group
- If the last group is complete, marks the pipeline as completed

Updated **`resolveRejection()`**:
- Navigates by group index rather than individual stage index
- `previous` goes to the first stage of the previous group
- `restart` goes to the first stage of the first group
- Clears `completedStageIds` on rejection so the target group restarts cleanly

### 2. Server — skip-stage endpoint (`server/src/routes/pipelines.ts`)

Updated the board-override skip-stage handler:
- Marks the skipped stage as completed in `stateJson.completedStageIds`
- Groups stages by `stageOrder` and checks if the entire parallel group is done
- If more stages remain in the group, advances to the next unfinished sibling
- If the group is complete, advances to the next group or completes the pipeline

Also includes the pipeline-run GET endpoint (`GET /issues/:issueId/pipeline-run`)
and the skip-stage POST endpoint (`POST /pipeline-runs/:id/skip-stage`) which
were added as part of the BET-23/BET-24 WIP and are committed here.

### 3. UI — pipeline progress (`ui/src/components/IssuePipelineProgress.tsx`)

- Groups stages by `stageOrder` for display
- Single stages render inline as before
- Parallel groups render stacked vertically inside a dashed-border container
  with a "parallel" label
- Completion tracking merges `executionState.completedStageIds` with
  `pipelineRun.stateJson.completedStageIds`
- Extracted `StagePill` helper component for reuse

### 4. UI — pipeline builder (`ui/src/pages/PipelineDetail.tsx`)

- Stage list groups stages by `stageOrder` — parallel groups shown in a dashed
  container with a `Layers` icon and "Parallel Group" header
- Added "Placement" selector to the Add Stage dialog: users can place a new
  stage as a new sequential step or in parallel with any existing group
- New stage order computed from the selected group or as `max(existing) + 1`

### 5. UI — API client and query keys

- `ui/src/api/pipelines.ts` — added `getIssuePipelineRun()` and `skipStage()` methods
- `ui/src/lib/queryKeys.ts` — added `issuePipelineRun` query key

## Files Changed

- `server/src/services/issues.ts` — parallel group logic in pipeline transitions
- `server/src/routes/pipelines.ts` — skip-stage parallel handling, pipeline-run endpoint
- `ui/src/components/IssuePipelineProgress.tsx` — parallel group display
- `ui/src/pages/PipelineDetail.tsx` — parallel group builder UI
- `ui/src/api/pipelines.ts` — pipeline run and skip-stage API methods
- `ui/src/lib/queryKeys.ts` — issuePipelineRun query key
- `ui/src/pages/IssueDetail.tsx` — import for IssuePipelineProgress (no functional change)
- `docs/work-items/BET-25-parallel-stages.md` — this doc
