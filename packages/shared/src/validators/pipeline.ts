import { z } from "zod";
import {
  PIPELINE_STATUSES,
  PIPELINE_STAGE_TYPES,
  PIPELINE_STAGE_ON_COMPLETE,
  PIPELINE_STAGE_ON_REJECT,
} from "../constants.js";

export const createPipelineSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().uuid().optional().nullable(),
  status: z.enum(PIPELINE_STATUSES).optional().default("active"),
});

export type CreatePipeline = z.infer<typeof createPipelineSchema>;

export const updatePipelineSchema = createPipelineSchema.partial();

export type UpdatePipeline = z.infer<typeof updatePipelineSchema>;

const pipelineStageShape = z.object({
  name: z.string().min(1),
  stageOrder: z.number().int().min(0),
  agentId: z.string().uuid().optional().nullable(),
  stageType: z.enum(PIPELINE_STAGE_TYPES).optional().default("action"),
  subPipelineId: z.string().uuid().optional().nullable(),
  onComplete: z.enum(PIPELINE_STAGE_ON_COMPLETE).optional().default("next"),
  onReject: z.enum(PIPELINE_STAGE_ON_REJECT).optional().default("stop"),
});

export const createPipelineStageSchema = pipelineStageShape.refine(
  (data) => data.stageType !== "sub_pipeline" || !!data.subPipelineId,
  { message: "subPipelineId is required when stageType is sub_pipeline", path: ["subPipelineId"] },
);

export type CreatePipelineStage = z.infer<typeof createPipelineStageSchema>;

export const updatePipelineStageSchema = pipelineStageShape.partial();

export type UpdatePipelineStage = z.infer<typeof updatePipelineStageSchema>;
