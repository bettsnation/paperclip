import { useQuery } from "@tanstack/react-query";
import { pipelinesApi } from "../api/pipelines";
import { queryKeys } from "../lib/queryKeys";
import type { IssueExecutionState } from "@paperclipai/shared";

const stageTypeBadgeColors: Record<string, string> = {
  action: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  review: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approval: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

interface PipelineStageBadgeProps {
  projectId: string | null;
  executionState: IssueExecutionState | null | undefined;
}

export function PipelineStageBadge({ projectId, executionState }: PipelineStageBadgeProps) {
  const currentStageId = executionState?.currentStageId ?? null;
  const currentStageType = executionState?.currentStageType ?? null;

  const { data: pipeline } = useQuery({
    queryKey: queryKeys.pipelines.projectPipeline(projectId!),
    queryFn: () => pipelinesApi.getProjectPipeline(projectId!).catch(() => null),
    enabled: !!projectId && !!currentStageId,
  });

  const { data: stages } = useQuery({
    queryKey: queryKeys.pipelines.stages(pipeline?.id ?? ""),
    queryFn: () => pipelinesApi.listStages(pipeline!.id),
    enabled: !!pipeline?.id,
  });

  if (!currentStageId || !currentStageType) return null;

  const currentStage = stages?.find((s) => s.id === currentStageId);
  const stageName = currentStage?.name ?? currentStageType;
  const colorClass = stageTypeBadgeColors[currentStageType] ?? stageTypeBadgeColors.action;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight whitespace-nowrap ${colorClass}`}
    >
      {stageName}
    </span>
  );
}
