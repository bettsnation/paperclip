---
id: BET-36
title: "Pipeline UI polish — sidebar badge, project config, detail page editing, approvals"
status: done
branch: wi/BET-29
target: feature/pipelines
date: 2026-04-09
---

# BET-36: Pipeline UI Polish

Comprehensive UI improvements bringing the pipeline feature to parity with other Paperclip features (Routines, Issues) in terms of editability and polish.

## Changes

### 1. Sidebar: Beta Badge on Pipelines
- Added `textBadge="Beta"` and `textBadgeTone` to the Pipelines sidebar nav item, matching the Routines entry

### 2. Project Configuration: Section Reorder
- Moved Pipeline section above Danger Zone so Danger Zone is always last
- Section order: General → Codebase → Pipeline → Danger Zone

### 3. Project Configuration: Change/Detach Pipeline
- Attached pipeline name now renders as a link to the pipeline detail page
- Added Change button to switch to a different pipeline
- Added Detach button to remove the pipeline association from the project

### 4. Pipeline Detail: Inline Name Editing
- Click the pipeline heading to enter inline text editing mode
- Enter saves via `PATCH /api/pipelines/:id`, Escape cancels
- Empty names are rejected

### 5. Pipeline Detail: Stage Editing
- Click any existing stage to open an inline edit form
- All stage properties are editable: name, stageType, agentId, onComplete, onReject, timeoutMinutes, approverCount, approverAgentIds, subPipelineId
- Save via `PATCH /api/pipelines/:id/stages/:stageId`

### 6. Pipeline Detail: Expanded Properties Panel
- Added editable description field (new `description` column on pipelines table)
- Shows linked project with clickable link
- Shows stage count summary

### 7. Approvals Page: Pipeline Stage Approval Rendering
- `PIPELINE_STAGE_APPROVAL` approvals now render as a formatted card with issue link, stage name, and summary instead of raw JSON

### 8. Inbox: Pipeline Approval Type Label
- Changed from truncated raw type `pipeline_stage_appr...` to human-readable `Pipeline Approval` label

### 9. Pipelines List Page: Heading and Description
- Added Beta badge on page heading (matching Routines)
- Added description text explaining what pipelines do

### 10. Pipeline List Menu: Additional Actions
- Expanded the `...` menu beyond just Delete to include: Edit (navigate to detail), Duplicate, Pause/Resume, and Archive

## Migration

- `packages/db/src/migrations/0056_pipeline_description_timeout.sql` — adds `description` and `timeoutMinutes` columns to pipelines table

## Files Changed

### Database & Types
- `packages/db/src/migrations/0056_pipeline_description_timeout.sql` — new migration
- `packages/db/src/schema/pipelines.ts` — added `description` column
- `packages/shared/src/types/pipeline.ts` — added `description` field to Pipeline type
- `packages/shared/src/validators/pipeline.ts` — added `description` to validators
- `packages/shared/src/index.ts` — export `ApprovalDecision` from package root (fix commit `f8572715`)

### Server
- `server/src/routes/pipelines.ts` — stage PATCH endpoint for editing existing stages

### UI
- `ui/src/components/Sidebar.tsx` — Beta badge on Pipelines nav item
- `ui/src/components/ApprovalPayload.tsx` — formatted pipeline approval card rendering
- `ui/src/components/ProjectProperties.tsx` — section reorder, change/detach pipeline actions
- `ui/src/pages/PipelineDetail.tsx` — inline name editing, stage editing, description field, properties panel
- `ui/src/pages/Pipelines.tsx` — heading/description, expanded menu actions
- `ui/src/pages/ProjectDetail.tsx` — pipeline section improvements
- `ui/src/api/pipelines.ts` — approval decisions API import fix
