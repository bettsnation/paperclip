---
issue: BET-50
source_type: fix
components: [pipeline-engine, approvals]
tags: [pipeline, approval, auto-advance, orphan-cleanup]
files_changed:
  - server/src/routes/approvals.ts
  - server/src/services/issues.ts
  - server/src/__tests__/approval-routes-idempotency.test.ts
date_completed: 2026-04-11
---

## Problem

When a board member approves a `pipeline_stage_approval`, the approval status changes to approved but the pipeline does not advance to the next stage. The issue stays stuck on the approval stage until someone manually sets status to done. Additionally, pipeline approval payloads did not include the human-readable issue identifier, and orphaned approvals from cancelled/done issues were not cleaned up.

## Solution

Three fixes applied:

1. **Auto-advance on approval**: When `POST /approvals/:id/approve` resolves a `pipeline_stage_approval`, the route handler now calls `issueService.update()` with `status: "done"` on each linked issue. This triggers `evaluatePipelineTransition()` which naturally advances the pipeline to the next stage and assigns the next agent. The same pattern is applied for rejection (`changes_requested`).

2. **Issue identifier in payload**: Added `issueIdentifier` field to the approval payload created by `buildAdvanceAction()`, and included the identifier in the summary text for better readability in Telegram/UI notifications.

3. **Orphaned approval cleanup**: Added logic in the issue `update()` function that auto-rejects any pending `pipeline_stage_approval` approvals linked to an issue when it transitions to `done` or `cancelled` outside the normal pipeline flow.

## Changes Made

- `server/src/routes/approvals.ts` — added pipeline auto-advance on approve (calls `issueService.update` with `done`), pipeline rejection on reject (calls with `changes_requested`), imported `issueService`
- `server/src/services/issues.ts` — added `issueIdentifier` to approval payload in `buildAdvanceAction()`, added orphaned approval auto-rejection in `update()` when status becomes `done` or `cancelled`
- `server/src/__tests__/approval-routes-idempotency.test.ts` — added `issueService` mock to fix test initialization after new import

## Verification

- TypeScript compilation passes
- Server build succeeds
- Existing approval route tests pass (2/2 relevant tests pass; 1 pre-existing failure unrelated to this change)

## Lessons Learned

- The pipeline engine's `evaluatePipelineTransition` is designed to be triggered by issue status changes. The cleanest way to hook external events (like approval resolution) into the pipeline is to call `issueService.update()` with the appropriate status, rather than duplicating pipeline logic.
- Tests that mock service imports need updating when new service imports are added to the routes.
