-- Add description to pipelines
ALTER TABLE "pipelines" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint

-- Add timeout_minutes to pipeline_stages
ALTER TABLE "pipeline_stages" ADD COLUMN "timeout_minutes" integer;
