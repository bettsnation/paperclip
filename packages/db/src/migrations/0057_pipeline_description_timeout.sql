-- Add description to pipelines
ALTER TABLE "pipelines" ADD COLUMN "description" text DEFAULT '' NOT NULL;
