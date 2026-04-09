-- Drop multi-approver dead code: approval_decisions table and multi-approver columns on pipeline_stages
DROP TABLE IF EXISTS "approval_decisions";--> statement-breakpoint
ALTER TABLE "pipeline_stages" DROP COLUMN IF EXISTS "approver_count";--> statement-breakpoint
ALTER TABLE "pipeline_stages" DROP COLUMN IF EXISTS "approver_agent_ids";
