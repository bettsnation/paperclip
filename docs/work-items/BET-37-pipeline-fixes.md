# BET-37: Pipeline engine fixes — parallel, sub-pipelines, timeouts, cleanup, UX

## Summary

Combined fix for pipeline engine bugs, dead code removal, and UX improvements.

## Changes

### Bugs (verified/fixed)

1. **Parallel stages completedStageIds** — Already fixed in `a88bac29` on feature/pipelines. The merge now spreads `pipelineState` INTO the result's `stateJson` (which preserves `completedStageIds`) instead of replacing it.

2. **Sub-pipelines — child run unreachable** — Redesigned sub-pipelines to create a **child issue** with its own pipeline run instead of a child run on the same issue. When the child issue's pipeline completes, `advanceParentOnChildCompletion` auto-advances the parent's `sub_pipeline` stage. This prevents the parent run from shadowing the child run during lookup.
   - `PipelineAction.createSubPipelineRun` now carries `companyId`, `projectId`, `stageName`
   - `applyPipelineAction` creates a child issue with `parentId`, `originKind: "sub_pipeline"`, and a pipeline run on the child issue
   - Child issue gets the first stage's agent assignment

3. **Stage timeouts** — Already wired up in the existing `setInterval` block in `index.ts` (lines 613-622). `checkTimeouts()` runs alongside heartbeat and routine ticks.

### Dead code removal

4. **Multi-approver removed:**
   - Dropped `approverCount` and `approverAgentIds` from `pipeline_stages` schema
   - Dropped `approval_decisions` table and schema
   - Removed `POST /approvals/:id/decisions` and `GET /approvals/:id/decisions` endpoints
   - Removed `ApprovalDecision` type from shared package
   - Removed multi-approver UI (approver count input in stage editor/cards)
   - Migration `0058_drop_multi_approver.sql`

### UX improvements

5. **Stage delete confirmation** — Delete button now opens a confirmation dialog: "Delete stage [name]? This cannot be undone." with Cancel/Delete buttons.

6. **Edit mode toggle** — Stages default to read-only view. An "Edit Pipeline" button toggles edit mode, revealing drag handles, edit pencils, delete buttons, and the Add Stage button.

7. **Stage display numbers** — Fixed to show sequential display position (`#1, #2, #3`) based on group index instead of raw `stageOrder` value.

8. **Project link clickable** — Properties panel project name is now a clickable link to the project page.

9. **Stage type breakdown** — Properties panel shows "4 stages: 2 action, 1 review, 1 approval" instead of just "4 stages".

10. **Attach existing pipeline API** — Added `PUT /projects/:projectId/pipeline` endpoint that accepts `{ pipelineId }` to attach an existing pipeline to a project. Validates company match, prevents conflicts.

## Files changed

- `server/src/services/issues.ts` — Sub-pipeline child issue creation, multi-approver cleanup
- `server/src/routes/pipelines.ts` — Removed approval decisions endpoints, added PUT attach endpoint
- `packages/db/src/schema/pipelines.ts` — Removed `approverCount`, `approverAgentIds`, `approvalDecisions`
- `packages/db/src/schema/index.ts` — Updated export
- `packages/db/src/migrations/0058_drop_multi_approver.sql` — New migration
- `packages/shared/src/types/pipeline.ts` — Removed `ApprovalDecision`, `approverCount`, `approverAgentIds`
- `packages/shared/src/types/index.ts` — Updated export
- `packages/shared/src/index.ts` — Updated export
- `packages/shared/src/validators/pipeline.ts` — Removed `approverCount`, `approverAgentIds`
- `ui/src/api/pipelines.ts` — Removed approval decision methods, added `attachExistingPipeline`
- `ui/src/pages/PipelineDetail.tsx` — Edit mode toggle, delete confirmation, stage numbers, project link, type breakdown
- `ui/src/components/ApprovalPayload.tsx` — Removed approver count display
