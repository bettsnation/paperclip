ALTER TABLE "pipeline_stages" ADD COLUMN "timeout_minutes" integer;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "stage_entered_at" timestamp with time zone;
