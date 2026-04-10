import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Circle, Clock, Loader2, XCircle } from "lucide-react";
import { pipelinesApi } from "../api/pipelines";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime } from "../lib/utils";
import type { PipelineRun, PipelineStage } from "@paperclipai/shared";

const statusConfig: Record<string, { icon: typeof Check; color: string; label: string }> = {
  running: { icon: Loader2, color: "text-cyan-600 dark:text-cyan-400", label: "Running" },
  completed: { icon: Check, color: "text-emerald-600 dark:text-emerald-400", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-600 dark:text-red-400", label: "Failed" },
};

function RunRow({ run, stages }: { run: PipelineRun; stages: PipelineStage[] | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[run.status] ?? statusConfig.running;
  const Icon = config.icon;
  const stateJson = (run.stateJson ?? {}) as Record<string, unknown>;
  const completedStageIds = new Set<string>(
    Array.isArray(stateJson.completedStageIds) ? (stateJson.completedStageIds as string[]) : [],
  );
  const skipLog = Array.isArray(stateJson.skipLog) ? stateJson.skipLog : [];

  const duration =
    run.status !== "running" && run.createdAt && run.updatedAt
      ? formatDuration(new Date(run.createdAt), new Date(run.updatedAt))
      : null;

  return (
    <div className="border border-border rounded-md text-xs">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent/30 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color} ${run.status === "running" ? "animate-spin" : ""}`} />
        <span className="font-medium">{config.label}</span>
        <span className="text-muted-foreground">{run.id.slice(0, 8)}</span>
        <span className="text-muted-foreground ml-auto">{relativeTime(run.createdAt)}</span>
        {duration && <span className="text-muted-foreground">({duration})</span>}
      </button>

      {expanded && stages && stages.length > 0 && (
        <div className="px-3 pb-2 space-y-1 border-t border-border pt-2">
          {stages.map((stage) => {
            const isCompleted = completedStageIds.has(stage.id);
            const isCurrent = run.currentStageId === stage.id;
            const wasSkipped = skipLog.some(
              (e: Record<string, unknown>) => e.stageId === stage.id,
            );
            return (
              <div key={stage.id} className="flex items-center gap-2 py-0.5">
                {isCompleted ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : isCurrent && run.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin text-cyan-500" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={isCompleted ? "text-foreground" : "text-muted-foreground"}>
                  {stage.name}
                </span>
                <span className="text-muted-foreground/60 text-[10px]">{stage.stageType}</span>
                {wasSkipped && (
                  <span className="text-amber-600 dark:text-amber-400 text-[10px]">skipped</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface PipelineRunHistoryProps {
  issueId: string;
}

export function PipelineRunHistory({ issueId }: PipelineRunHistoryProps) {
  const [open, setOpen] = useState(false);

  const { data: runs } = useQuery({
    queryKey: queryKeys.pipelines.issuePipelineRuns(issueId),
    queryFn: () => pipelinesApi.getIssuePipelineRuns(issueId),
    enabled: !!issueId,
  });

  // Only show if there are completed/failed runs (history worth seeing)
  const historyRuns = runs?.filter((r) => r.status !== "running") ?? [];
  if (historyRuns.length === 0) return null;

  // Get stages for the first run's pipeline (they'll share the same pipeline in most cases)
  const pipelineId = historyRuns[0]?.pipelineId;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Clock className="h-3.5 w-3.5" />
        <span>Pipeline History ({historyRuns.length} run{historyRuns.length !== 1 ? "s" : ""})</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {open && (
        <RunList runs={historyRuns} pipelineId={pipelineId} />
      )}
    </div>
  );
}

function RunList({ runs, pipelineId }: { runs: PipelineRun[]; pipelineId: string | undefined }) {
  const { data: stages } = useQuery({
    queryKey: queryKeys.pipelines.stages(pipelineId ?? ""),
    queryFn: () => pipelinesApi.listStages(pipelineId!),
    enabled: !!pipelineId,
  });

  const sortedStages = stages ? [...stages].sort((a, b) => a.stageOrder - b.stageOrder) : undefined;

  return (
    <div className="space-y-1.5">
      {runs.map((run) => (
        <RunRow key={run.id} run={run} stages={sortedStages} />
      ))}
    </div>
  );
}
