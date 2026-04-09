import { z } from "zod";
import {
  PIPELINE_STATUSES,
  PIPELINE_STAGE_TYPES,
  PIPELINE_STAGE_ON_COMPLETE,
  PIPELINE_STAGE_ON_REJECT,
} from "../constants.js";

export const createPipelineSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(PIPELINE_STATUSES).optional().default("active"),
});

export type CreatePipeline = z.infer<typeof createPipelineSchema>;

export const updatePipelineSchema = createPipelineSchema.partial();

export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;

export const createPipelineStageSchema = z.object({
  name: z.string().min(1),
  stageOrder: z.number().int().min(0),
  agentId: z.string().uuid().optional().nullable(),
  stageType: z.enum(PIPELINE_STAGE_TYPES).optional().default("action"),
  onComplete: z.enum(PIPELINE_STAGE_ON_COMPLETE).optional().default("next"),
  onReject: z.enum(PIPELINE_STAGE_ON_REJECT).optional().default("stop"),
  timeoutMinutes: z.number().int().min(1).optional().nullable(),
  subPipelineId: z.string().uuid().optional().nullable(),
  approverCount: z.number().int().min(1).optional().default(1),
  approverAgentIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreatePipelineStage = z.infer<typeof createPipelineStageSchema>;

export const updatePipelineStageSchema = createPipelineStageSchema.partial();

export type UpdatePipelineStage = z.infer<typeof updatePipelineStageSchema>;
