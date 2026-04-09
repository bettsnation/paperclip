export interface Pipeline {
  id: string;
  companyId: string;
  projectId: string | null;
  name: string;
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
  subPipelineId: string | null;
  onComplete: string;
  onReject: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  issueId: string | null;
  parentRunId: string | null;
  currentStageId: string | null;
  status: string;
  stateJson: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
