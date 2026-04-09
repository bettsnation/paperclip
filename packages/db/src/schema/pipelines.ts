import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";

export const pipelines = pgTable(
  "pipelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("pipelines_company_idx").on(table.companyId),
    companyStatusIdx: index("pipelines_company_status_idx").on(table.companyId, table.status),
  }),
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id").notNull().references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    stageOrder: integer("stage_order").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    stageType: text("stage_type").notNull().default("action"),
    onComplete: text("on_complete").notNull().default("next"),
    onReject: text("on_reject").notNull().default("stop"),
    timeoutMinutes: integer("timeout_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pipelineIdx: index("pipeline_stages_pipeline_idx").on(table.pipelineId),
    pipelineOrderIdx: index("pipeline_stages_pipeline_order_idx").on(table.pipelineId, table.stageOrder),
  }),
);

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id").notNull().references(() => pipelines.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    currentStageId: uuid("current_stage_id").references(() => pipelineStages.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    stateJson: jsonb("state_json").$type<Record<string, unknown>>(),
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pipelineIdx: index("pipeline_runs_pipeline_idx").on(table.pipelineId),
    issueIdx: index("pipeline_runs_issue_idx").on(table.issueId),
    statusIdx: index("pipeline_runs_status_idx").on(table.pipelineId, table.status),
  }),
);
