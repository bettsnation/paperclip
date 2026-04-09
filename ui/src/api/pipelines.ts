import type { ApprovalDecision, Pipeline, PipelineRun, PipelineStage } from "@paperclipai/shared";
import { api } from "./client";

export const pipelinesApi = {
  list: (companyId: string) =>
    api.get<Pipeline[]>(`/companies/${companyId}/pipelines`),
  get: (id: string) => api.get<Pipeline>(`/pipelines/${id}`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Pipeline>(`/companies/${companyId}/pipelines`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Pipeline>(`/pipelines/${id}`, data),
  remove: (id: string) => api.delete<Pipeline>(`/pipelines/${id}`),

  // Stages
  listStages: (pipelineId: string) =>
    api.get<PipelineStage[]>(`/pipelines/${pipelineId}/stages`),
  createStage: (pipelineId: string, data: Record<string, unknown>) =>
    api.post<PipelineStage>(`/pipelines/${pipelineId}/stages`, data),
  updateStage: (stageId: string, data: Record<string, unknown>) =>
    api.patch<PipelineStage>(`/pipeline-stages/${stageId}`, data),
  removeStage: (stageId: string) =>
    api.delete<PipelineStage>(`/pipeline-stages/${stageId}`),

  // Project pipeline
  getProjectPipeline: (projectId: string) =>
    api.get<Pipeline>(`/projects/${projectId}/pipeline`),
  attachProjectPipeline: (projectId: string, data: Record<string, unknown>) =>
    api.post<Pipeline>(`/projects/${projectId}/pipeline`, data),

  // Pipeline runs
  getIssuePipelineRun: (issueId: string) =>
    api.get<PipelineRun>(`/issues/${issueId}/pipeline-run`),
  skipStage: (runId: string, reason: string) =>
    api.post<PipelineRun>(`/pipeline-runs/${runId}/skip-stage`, { reason }),

  // Approval decisions (multi-approver)
  listApprovalDecisions: (approvalId: string) =>
    api.get<ApprovalDecision[]>(`/approvals/${approvalId}/decisions`),
  submitApprovalDecision: (approvalId: string, decision: string, comment?: string) =>
    api.post(`/approvals/${approvalId}/decisions`, { decision, comment }),
};
