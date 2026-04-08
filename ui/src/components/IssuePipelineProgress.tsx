import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { Check, Circle, Loader2 } from "lucide-react";
import { pipelinesApi } from "../api/pipelines";
import { queryKeys } from "../lib/queryKeys";
import type { IssueExecutionState } from "@paperclipai/shared";

const stageTypeColors: Record<string, string> = {
  action: "border-blue-500/50 text-blue-600 dark:text-blue-400",
  review: "border-amber-500/50 text-amber-600 dark:text-amber-400",
  approval: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
};

interface IssuePipelineProgressProps {
  projectId: string | null;
  executionState: IssueExecutionState | null | undefined;
}

export function IssuePipelineProgress({ projectId, executionState }: IssuePipelineProgressProps) {
  const { data: pipeline } = useQuery({
    queryKey: queryKeys.pipelines.projectPipeline(projectId!),
    queryFn: () => pipelinesApi.getProjectPipeline(projectId!).catch(() => null),
    enabled: !!projectId,
  });

  const { data: stages } = useQuery({
    queryKey: queryKeys.pipelines.stages(pipeline?.id ?? ""),
    queryFn: () => pipelinesApi.listStages(pipeline!.id),
    enabled: !!pipeline?.id,
  });

  if (!pipeline || !stages || stages.length === 0) return null;

  const sortedStages = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);
  const completedIds = new Set(executionState?.completedStageIds ?? []);
  const currentStageId = executionState?.currentStageId ?? null;

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pipeline: {pipeline.name}
        </h4>
        <Link
          to={`/pipelines/${pipeline.id}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View
        </Link>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {sortedStages.map((stage, i) => {
          const isCompleted = completedIds.has(stage.id);
          const isCurrent = stage.id === currentStageId;
          const isPending = !isCompleted && !isCurrent;

          return (
            <div key={stage.id} className="flex items-center gap-1 shrink-0">
              <div
                className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                  isCompleted
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : isCurrent
                      ? `${stageTypeColors[stage.stageType] ?? stageTypeColors.action} bg-accent/50 font-medium`
                      : "border-border text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : isCurrent ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                <span>{stage.name}</span>
              </div>
              {i < sortedStages.length - 1 && (
                <span className="text-muted-foreground text-xs">&rarr;</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
