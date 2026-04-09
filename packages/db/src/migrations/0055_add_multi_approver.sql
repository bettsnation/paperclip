ALTER TABLE "pipeline_stages" ADD COLUMN "approver_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD COLUMN "approver_agent_ids" jsonb;--> statement-breakpoint
CREATE TABLE "approval_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_id" uuid NOT NULL,
	"decided_by_user_id" text,
	"decided_by_agent_id" uuid,
	"decision" text NOT NULL,
	"decision_note" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_decided_by_agent_id_agents_id_fk" FOREIGN KEY ("decided_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_decisions_approval_idx" ON "approval_decisions" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "approval_decisions_approval_user_idx" ON "approval_decisions" USING btree ("approval_id","decided_by_user_id");
