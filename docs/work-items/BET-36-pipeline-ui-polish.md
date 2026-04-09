---
issue: BET-36
source_type: feature
components: [pipelines, sidebar, project-config, approvals, inbox]
tags: [ui-polish, pipeline-editing, beta-badge]
files_changed:
  - packages/db/src/migrations/0056_pipeline_description_timeout.sql
  - packages/db/src/schema/pipelines.ts
  - packages/shared/src/types/pipeline.ts
  - packages/shared/src/validators/pipeline.ts
  - server/src/routes/pipelines.ts
  - ui/src/components/Sidebar.tsx
  - ui/src/components/ApprovalPayload.tsx
  - ui/src/components/ProjectProperties.tsx
  - ui/src/pages/PipelineDetail.tsx
  - ui/src/pages/Pipelines.tsx
  - ui/src/pages/ProjectDetail.tsx
  - ui/src/api/pipelines.ts
date_completed: 2026-04-09
---

## Problem

The pipeline feature was functionally complete but the UI had several rough edges: no Beta badge, pipeline config below Danger Zone on project pages, no way to edit pipeline names or existing stages, raw JSON in approval cards, and a minimal pipeline list page.

## Solution

Comprehensive UI polish across 10 areas to bring pipelines to parity with Routines and other established Paperclip features.

## Changes Made

### 1. Sidebar: Beta Badge on Pipelines
- `ui/src/components/Sidebar.tsx` — added `textBadge="Beta"` and `textBadgeTone="amber"` to Pipelines nav item

### 2. Project Configuration: Section Reorder
- `ui/src/pages/ProjectDetail.tsx` — moved Pipeline section above Danger Zone

### 3. Project Configuration: Change/Detach Pipeline
- `ui/src/pages/ProjectDetail.tsx` — attached pipeline renders as link with Change/Detach actions
- `server/src/routes/pipelines.ts` — added `DELETE /projects/:projectId/pipeline` endpoint for detaching

### 4. Pipeline Detail: Inline Name Editing
- `ui/src/pages/PipelineDetail.tsx` — click heading to edit, Enter saves, Escape cancels

### 5. Pipeline Detail: Stage Editing
- `ui/src/pages/PipelineDetail.tsx` — click stage to open edit form with all properties

### 6. Pipeline Detail: Expanded Properties Panel
- `ui/src/pages/PipelineDetail.tsx` — added description field, linked project, stage count summary
- `packages/db/src/schema/pipelines.ts` — added `description` column to pipelines table
- `packages/db/src/migrations/0056_pipeline_description_timeout.sql` — adds `description` column
- `packages/shared/src/types/pipeline.ts` — added `description` to Pipeline type
- `packages/shared/src/validators/pipeline.ts` — added `description` to validators

### 7. Approvals Page: Pipeline Stage Approval Rendering
- `ui/src/components/ApprovalPayload.tsx` — `PIPELINE_STAGE_APPROVAL` renders as formatted card instead of raw JSON

### 8. Inbox: Pipeline Approval Type Label
- Human-readable "Pipeline Approval" label instead of truncated `pipeline_stage_appr...`

### 9. Pipelines List Page: Heading and Description
- `ui/src/pages/Pipelines.tsx` — added Beta badge on page heading, description text

### 10. Pipeline List Menu: Additional Actions
- `ui/src/pages/Pipelines.tsx` — expanded menu: Edit, Duplicate, Pause/Resume, Archive (previously only Delete)

## Verification

- `pnpm -r typecheck` passes
- `pnpm build` passes
- Manual testing on paperclipdev.bettsnation.com

## Lessons Learned

- When branching for UI work, always branch from the latest base to avoid destructive conflicts with recently merged features (BET-22/23 pipeline variables and timeouts were nearly reverted by the original PR).
- The PR CI policy blocks lockfile changes — agents should never commit pnpm-lock.yaml.
