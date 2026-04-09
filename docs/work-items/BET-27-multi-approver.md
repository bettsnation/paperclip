---
id: BET-27
title: "Add multi-approver — require N of M approvals"
status: done
branch: wi/BET-27
target: feature/pipelines
date: 2026-04-09
---

# BET-27: Add multi-approver — require N of M approvals

## Summary

Adds multi-approver support to pipeline approval stages. A stage can now require
N approvals from a designated set of M approvers before advancing. Any single
rejection immediately triggers the stage's `onReject` behavior.

## Changes

### 1. Database schema — pipeline_stages columns
Added two columns to `pipeline_stages`:
- `approver_count` (integer, default 1) — number of approvals required to advance
- `approver_agent_ids` (jsonb, nullable) — array of agent UUIDs eligible to approve

### 2. Database schema — approval_decisions table
New `approval_decisions` table to track individual votes on an approval:
- `id`, `approval_id`, `decided_by_user_id`, `decided_by_agent_id`, `decision`, `decision_note`, `decided_at`
- Indexed on `(approval_id)` and `(approval_id, decided_by_user_id)` for fast lookups
- Cascade-deletes when the parent approval is removed

### 3. Migration
`0055_add_multi_approver.sql` — adds columns and creates the new table with
foreign keys and indexes.

### 4. Shared types and validators
- `PipelineStage` interface: added `approverCount` and `approverAgentIds` fields
- `ApprovalDecision` interface: new type for individual decision records
- `createPipelineStageSchema`: added optional `approverCount` (min 1, default 1) and `approverAgentIds` (uuid array) fields

### 5. Approval creation (issues service)
When a pipeline enters an approval stage, the auto-created `pipeline_stage_approval`
now includes `approverCount` and `approverAgentIds` in its payload, propagated from
the stage configuration.

### 6. Approval resolution (approvals service)
- **approve()**: For multi-approver approvals (`approverCount > 1`), records an
  individual decision and counts approved votes. The overall approval only resolves
  to "approved" when the count threshold is met. Below threshold, returns
  `applied: false` so no side-effects fire yet.
- **reject()**: Records the individual decision, then immediately resolves the
  entire approval as "rejected" (any single rejection triggers `onReject`).
- **listDecisions()**: New method to retrieve all individual decisions for an approval.

### 7. Decisions API endpoint
`GET /api/approvals/:id/decisions` — returns the list of individual approval
decisions, accessible to any company member.

## Files Changed
- `packages/db/src/schema/pipelines.ts` — added columns + `approvalDecisions` table
- `packages/db/src/schema/index.ts` — export `approvalDecisions`
- `packages/db/src/migrations/0055_add_multi_approver.sql` — migration
- `packages/db/src/migrations/meta/_journal.json` — journal entry
- `packages/shared/src/types/pipeline.ts` — `PipelineStage` + `ApprovalDecision`
- `packages/shared/src/types/index.ts` — export `ApprovalDecision`
- `packages/shared/src/index.ts` — export `ApprovalDecision`
- `packages/shared/src/validators/pipeline.ts` — schema updates
- `server/src/services/approvals.ts` — multi-approver logic + `listDecisions`
- `server/src/services/issues.ts` — propagate approver info to approval payload
- `server/src/routes/approvals.ts` — decisions endpoint
- `docs/work-items/BET-27-multi-approver.md` — this doc
