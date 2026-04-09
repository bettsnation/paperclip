export interface Pipeline {
  id: string;
  companyId: string;
  projectId: string | null;
  name: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  stageOrder: number;
  agentId: string | null;
  stageType: string;
  onComplete: string;
  onReject: string;
  timeoutMinutes: number | null;
  subPipelineId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  issueId: string | null;
  currentStageId: string | null;
  parentRunId: string | null;
  status: string;
  stateJson: Record<string, unknown> | null;
  stageEnteredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
