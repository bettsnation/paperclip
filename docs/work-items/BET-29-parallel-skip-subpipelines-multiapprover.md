---
id: BET-29
title: "Add parallel stages, conditional skip, sub-pipelines, and multi-approver"
status: done
branch: wi/BET-29
target: feature/pipelines
date: 2026-04-09
---

# BET-29: Parallel stages, conditional skip, sub-pipelines, and multi-approver

Combined Phase 2 + Phase 3 pipeline features in a single PR.

## Features

### 1. Parallel Stages
- Stages with the same `stageOrder` run in parallel
- `groupStagesByOrder()` helper groups stages by order
- `completedStageIds` tracked in `stateJson` to know which stages in a group are done
- `resolveCompletion` checks all siblings in a group before advancing to the next group
- UI displays parallel groups side-by-side with dashed border
- Stage editor supports placing a new stage in parallel with an existing group

### 2. Conditional Stage Skip (Board Override)
- `POST /api/pipeline-runs/:id/skip-stage` endpoint
- Board-only access via `assertBoard`
- Cannot skip approval or sub_pipeline stages
- Records skip in `stateJson.skipLog` with reason, actor, timestamp
- Posts a comment on the linked issue
- Advances pipeline to next stage (respecting parallel groups)

### 3. Sub-pipelines
- New `sub_pipeline` stage type
- `subPipelineId` column on `pipeline_stages` (FK to pipelines)
- `parentRunId` column on `pipeline_runs` (FK to pipeline_runs)
- Sub-pipeline stages block manual `done` (cannot complete manually)
- When a sub_pipeline stage is reached, auto-creates a child `pipeline_run`
- When the child run completes, `advanceParentOnChildCompletion()` auto-advances the parent
- Migration 0055 adds both columns

### 4. Multi-approver
- `approverCount` (default 1) and `approverAgentIds` (JSONB array) on `pipeline_stages`
- `approval_decisions` table stores individual votes (approve/reject with comment)
- `POST /api/approvals/:id/decisions` endpoint to submit individual votes
- `GET /api/approvals/:id/decisions` endpoint to list votes
- Approve: counts votes, resolves only when `approverCount` threshold met
- Reject: any single rejection immediately fails the approval and blocks the pipeline
- `approverCount` stored in approval payload for threshold checking

## Files Changed

### Migration
- `packages/db/src/migrations/0055_sub_pipelines_multi_approver.sql`

### Schema & Types
- `packages/db/src/schema/pipelines.ts` — added `subPipelineId`, `approverCount`, `approverAgentIds` to stages; `parentRunId` to runs; new `approvalDecisions` table
- `packages/db/src/schema/index.ts` — export `approvalDecisions`
- `packages/shared/src/types/pipeline.ts` — added new fields + `ApprovalDecision` interface
- `packages/shared/src/types/index.ts` — export `ApprovalDecision`
- `packages/shared/src/constants.ts` — added `sub_pipeline` to `PIPELINE_STAGE_TYPES`
- `packages/shared/src/validators/pipeline.ts` — added `subPipelineId`, `approverCount`, `approverAgentIds`

### Server
- `server/src/services/issues.ts` — sub_pipeline status constraints, sub-pipeline run creation, parent auto-advance on child completion, multi-approver payload
- `server/src/routes/pipelines.ts` — skip-stage blocks sub_pipeline, approval decisions endpoints

### UI
- `ui/src/api/pipelines.ts` — approval decisions API methods
- `ui/src/pages/PipelineDetail.tsx` — sub_pipeline type in editor, approver count display
- `ui/src/components/IssuePipelineProgress.tsx` — sub_pipeline colors, skip prevention
- `ui/src/components/PipelineStageBadge.tsx` — sub_pipeline badge color
