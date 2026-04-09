ALTER TABLE "pipeline_stages" ADD COLUMN "sub_pipeline_id" uuid;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_sub_pipeline_id_pipelines_id_fk" FOREIGN KEY ("sub_pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "parent_run_id" uuid;--> statement-breakpoint
CREATE INDEX "pipeline_runs_parent_run_idx" ON "pipeline_runs" USING btree ("parent_run_id");
