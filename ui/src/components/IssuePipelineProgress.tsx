import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { Check, Circle, Loader2, SkipForward } from "lucide-react";
import { pipelinesApi } from "../api/pipelines";
import { queryKeys } from "../lib/queryKeys";
import type { IssueExecutionState } from "@paperclipai/shared";

const stageTypeColors: Record<string, string> = {
  action: "border-blue-500/50 text-blue-600 dark:text-blue-400",
  review: "border-amber-500/50 text-amber-600 dark:text-amber-400",
  approval: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
};

function StagePill({
  stage,
  completedIds,
  currentStageId,
}: {
  stage: { id: string; name: string; stageType: string };
  completedIds: Set<string>;
  currentStageId: string | null;
}) {
  const isCompleted = completedIds.has(stage.id);
  const isCurrent = stage.id === currentStageId;
  return (
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
  );
}

interface IssuePipelineProgressProps {
  issueId: string;
  projectId: string | null;
  executionState: IssueExecutionState | null | undefined;
}

export function IssuePipelineProgress({ issueId, projectId, executionState }: IssuePipelineProgressProps) {
  const queryClient = useQueryClient();
  const [skipReason, setSkipReason] = useState("");
  const [showSkipDialog, setShowSkipDialog] = useState(false);

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

  const { data: pipelineRun } = useQuery({
    queryKey: queryKeys.pipelines.issuePipelineRun(issueId),
    queryFn: () => pipelinesApi.getIssuePipelineRun(issueId).catch(() => null),
    enabled: !!issueId,
  });

  const skipMutation = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason: string }) =>
      pipelinesApi.skipStage(runId, reason),
    onSuccess: () => {
      setShowSkipDialog(false);
      setSkipReason("");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

  if (!pipeline || !stages || stages.length === 0) return null;

  const sortedStages = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);

  // Completed stage IDs: merge execution state + pipeline run stateJson
  const runCompletedIds: string[] =
    (pipelineRun?.stateJson as Record<string, unknown> | null)?.completedStageIds as string[] ?? [];
  const completedIds = new Set([
    ...(executionState?.completedStageIds ?? []),
    ...runCompletedIds,
  ]);

  const currentStageId = pipelineRun?.currentStageId ?? executionState?.currentStageId ?? null;
  const currentStage = currentStageId ? sortedStages.find((s) => s.id === currentStageId) : null;
  const canSkip = pipelineRun && currentStage && currentStage.stageType !== "approval";

  // Group stages by stageOrder for parallel display
  const stageGroups: Array<typeof sortedStages> = [];
  const groupMap = new Map<number, typeof sortedStages>();
  for (const s of sortedStages) {
    let g = groupMap.get(s.stageOrder);
    if (!g) { g = []; groupMap.set(s.stageOrder, g); stageGroups.push(g); }
    g.push(s);
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pipeline: {pipeline.name}
        </h4>
        <div className="flex items-center gap-2">
          {canSkip && !showSkipDialog && (
            <button
              onClick={() => setShowSkipDialog(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Skip current stage (board override)"
            >
              <SkipForward className="h-3 w-3" />
              Skip Stage
            </button>
          )}
          <Link
            to={`/pipelines/${pipeline.id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View
          </Link>
        </div>
      </div>

      {showSkipDialog && pipelineRun && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Skip stage "{currentStage?.name}"? This cannot be undone.
          </p>
          <textarea
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            placeholder="Reason for skipping (required)"
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs resize-none"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => skipMutation.mutate({ runId: pipelineRun.id, reason: skipReason })}
              disabled={!skipReason.trim() || skipMutation.isPending}
              className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {skipMutation.isPending ? "Skipping..." : "Confirm Skip"}
            </button>
            <button
              onClick={() => { setShowSkipDialog(false); setSkipReason(""); }}
              className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              Cancel
            </button>
            {skipMutation.isError && (
              <span className="text-xs text-destructive">
                {(skipMutation.error as Error).message}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {stageGroups.map((group, gi) => (
          <div key={group[0].stageOrder} className="flex items-center gap-1 shrink-0">
            {group.length === 1 ? (
              // Single stage — render inline
              <StagePill stage={group[0]} completedIds={completedIds} currentStageId={currentStageId} />
            ) : (
              // Parallel group — stack vertically
              <div className="flex flex-col gap-0.5 rounded border border-dashed border-muted-foreground/30 px-1 py-0.5">
                <span className="text-[10px] text-muted-foreground text-center leading-none">parallel</span>
                {group.map((stage) => (
                  <StagePill key={stage.id} stage={stage} completedIds={completedIds} currentStageId={currentStageId} />
                ))}
              </div>
            )}
            {gi < stageGroups.length - 1 && (
              <span className="text-muted-foreground text-xs">&rarr;</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
