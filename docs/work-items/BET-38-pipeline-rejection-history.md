---
issue: BET-38
source_type: bugfix
components: [pipelines, pipeline-engine, pipeline-ui, issue-notifications]
tags: [rejection-fix, run-history, sub-pipeline, child-issues, status-transition]
files_changed:
  - server/src/services/issues.ts
  - server/src/routes/issues.ts
  - server/src/routes/pipelines.ts
  - ui/src/api/pipelines.ts
  - ui/src/components/IssuePipelineProgress.tsx
  - ui/src/components/PipelineRunHistory.tsx
  - ui/src/lib/queryKeys.ts
  - ui/src/pages/IssueDetail.tsx
date_completed: 2026-04-10
---

## Problem

Several bugs and missing features were found during functional testing of parallel stages, sub-pipelines, and rejection flows:

1. The rejection/rework loop was completely non-functional — `changes_requested` was not in the allowed statuses for review/approval stages, and `STAGE_REJECT_STATUSES` was set to `["in_progress"]` which incorrectly triggered rejection when working on a review.
2. No pipeline run history — `GET /issues/:id/pipeline-run` only returned running runs; completed runs returned 404.
3. Sub-pipeline child issues were created with empty descriptions.
4. Backwards status transition — advancing from a completed stage to the next action stage went from `done` to `todo`.
5. `IssuePipelineProgress` looked up the pipeline via projectId, which showed wrong stages for sub-pipeline child issues.
6. No UI to view completed pipeline runs.
7. No API to query all runs for a pipeline across issues.
8. Sub-pipeline child issues were not triggering agent wakeup notifications.

## Solution

### Bug #1: Rejection/rework loop fix
- Added `changes_requested` to `STAGE_ALLOWED_STATUSES` for `review` and `approval` stage types
- Changed `STAGE_REJECT_STATUSES` from `["in_progress"]` to `["changes_requested"]`
- Added `changes_requested` to `ALL_ISSUE_STATUSES`

### Bug #2: Pipeline run history endpoint
- Added `GET /issues/:issueId/pipeline-runs` route returning all runs for an issue ordered by creation date

### Bug #3: Child issue description
- Sub-pipeline child issues now include a description with parent issue identifier/title, pipeline name, and stage name

### Bug #4: Backwards status transition
- Added `isFirstStage` parameter to `defaultStatusForStageType()` — non-first action stages now return `in_progress` instead of `todo`
- Updated all call sites: `buildAdvanceAction` passes `false`, `resolveRejection` passes `false` for previous and `true` for restart

### Bug #5: Pipeline progress lookup
- `IssuePipelineProgress` now fetches the active pipeline run first, then resolves the pipeline from `pipelineRun.pipelineId`
- Falls back to project pipeline only when no active run exists

### Feature #6: Pipeline run history UI
- New `PipelineRunHistory` component with collapsible run rows showing status, duration, and stage details
- Shows completed/failed runs with skip log indicators
- Integrated into issue detail page below the pipeline progress bar

### Feature #7: Pipeline run list endpoint
- Added `GET /pipelines/:pipelineId/runs` route returning all runs for a pipeline across issues

### Bug #9: Sub-pipeline child issue notifications
- Added `onChildIssueCreated` callback to the issue update opts type
- `applyPipelineAction` now returns `PipelineActionResult` with `createdChildIssues`
- Issue update route collects child issues and queues wakeups for assigned agents

## Verification

- **stageEnteredAt** (item #8): Confirmed correctly set in `buildAdvanceAction` and at child pipeline run creation
- **Project link** (item #10): Already implemented as clickable link in pipeline properties panel
- Both server and UI compile cleanly with `tsc --noEmit`
