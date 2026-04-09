-- Sub-pipeline support: add sub_pipeline_id to pipeline_stages
ALTER TABLE "pipeline_stages" ADD COLUMN "sub_pipeline_id" uuid;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_sub_pipeline_id_pipelines_id_fk" FOREIGN KEY ("sub_pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Sub-pipeline support: add parent_run_id to pipeline_runs
ALTER TABLE "pipeline_runs" ADD COLUMN "parent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_parent_run_id_pipeline_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_runs_parent_run_idx" ON "pipeline_runs" USING btree ("parent_run_id");--> statement-breakpoint

-- Multi-approver support: add approver_count and approver_agent_ids to pipeline_stages
ALTER TABLE "pipeline_stages" ADD COLUMN "approver_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD COLUMN "approver_agent_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint

-- Multi-approver support: approval_decisions table
CREATE TABLE IF NOT EXISTS "approval_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "approval_id" uuid NOT NULL,
  "agent_id" uuid,
  "user_id" text,
  "decision" text NOT NULL,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_decisions_approval_idx" ON "approval_decisions" USING btree ("approval_id");
