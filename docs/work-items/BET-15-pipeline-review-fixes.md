---
id: BET-15
title: "Fix PR #2 review items — rebase, approval type, projectId, wakeup, routing bug"
status: done
branch: wi/BET-15
target: feature/pipelines
parent: BET-13
date: 2026-04-08
---

# BET-15: Pipeline PR #2 Review Fixes

## Changes

### 1. Rebase PR #2 on feature/pipelines
Branch `wi/BET-13` was already up-to-date with `feature/pipelines` — no rebase conflicts.

### 2. pipeline_stage_approval in APPROVAL_TYPES
Already present in `packages/shared/src/constants.ts` from prior commit on `wi/BET-13`.

### 3. projectId FK on pipelines schema
Verified `packages/db/src/schema/pipelines.ts` (on `feat/pipeline-schema` branch) has:
```typescript
projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
```
This matches migration 0054's `project_id` column.

### 4. Explicit agent wakeup after pipeline reassignment
Added `onPipelineReassignment` callback to `issueService.update()` in `server/src/services/issues.ts`.
Wired up in `server/src/routes/issues.ts` to fire a `pipeline_reassignment` wakeup via the heartbeat service.
This works around routing bug #2730 where the legacy run fallback could re-lock the issue to the old agent.

### 5. Routing lock bug fix in heartbeat.ts
Added `eq(heartbeatRuns.agentId, agentId)` to the legacy run fallback WHERE clause in
`server/src/services/heartbeat.ts` (~line 3782). This scopes the fallback query to the
current agent, preventing an old agent's orphaned run from re-locking the issue after
pipeline reassignment.

## Files Changed
- `server/src/services/issues.ts` — pipeline reassignment callback
- `server/src/routes/issues.ts` — explicit pipeline wakeup
- `server/src/services/heartbeat.ts` — legacy run agent scoping fix
- `docs/work-items/BET-15-pipeline-review-fixes.md` — this doc
