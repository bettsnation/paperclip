import { useEffect, useState } from "react";
import { useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  MouseSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Clock,
  GripVertical,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { pipelinesApi } from "../api/pipelines";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { usePanel } from "../context/PanelContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { InlineEditor } from "../components/InlineEditor";
import { StatusBadge } from "../components/StatusBadge";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PipelineStage } from "@paperclipai/shared";

const STAGE_TYPES = ["action", "review", "approval"] as const;
const ON_COMPLETE_OPTIONS = ["next", "done"] as const;
const ON_REJECT_OPTIONS = ["stop", "previous", "restart"] as const;

const stageTypeColors: Record<string, string> = {
  action: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  review: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  approval: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

interface SortableStageProps {
  stage: PipelineStage;
  agentName: string | null;
  isLast: boolean;
  onUpdate: (data: Record<string, unknown>) => void;
  onDelete: () => void;
}

function SortableStage({ stage, agentName, isLast, onUpdate, onDelete }: SortableStageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div className="flex items-stretch gap-0">
      <div
        ref={setNodeRef}
        style={style}
        className="flex-1 border border-border rounded-md bg-card p-3 space-y-2"
      >
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-mono text-muted-foreground">#{stage.stageOrder + 1}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${stageTypeColors[stage.stageType] ?? stageTypeColors.action}`}>
            {stage.stageType}
          </span>
          <span className="flex-1 text-sm font-medium truncate">{stage.name}</span>
          <Button variant="ghost" size="icon-xs" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
        {agentName && (
          <p className="text-xs text-muted-foreground ml-6">
            Agent: <span className="text-foreground">{agentName}</span>
          </p>
        )}
        <div className="flex items-center gap-3 ml-6 text-xs text-muted-foreground">
          <span>
            On complete: <span className="text-foreground">{stage.onComplete}</span>
          </span>
          <span>
            On reject: <span className="text-foreground">{stage.onReject}</span>
          </span>
          {stage.timeoutMinutes != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Timeout: <span className="text-foreground">{stage.timeoutMinutes}m</span>
            </span>
          )}
        </div>
      </div>
      {!isLast && (
        <div className="flex items-center px-1">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function PipelineProperties({
  pipeline,
  onUpdate,
}: {
  pipeline: { id: string; status: string; createdAt: Date | string; updatedAt: Date | string };
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Properties</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={pipeline.status} onValueChange={(status) => onUpdate({ status })}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Created</label>
          <p className="text-xs mt-0.5">{new Date(pipeline.createdAt).toLocaleDateString()}</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Updated</label>
          <p className="text-xs mt-0.5">{new Date(pipeline.updatedAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

export function PipelineDetail() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageType, setNewStageType] = useState<string>("action");
  const [newStageAgentId, setNewStageAgentId] = useState<string>("__none__");
  const [newStageOnComplete, setNewStageOnComplete] = useState<string>("next");
  const [newStageOnReject, setNewStageOnReject] = useState<string>("stop");
  const [newStageTimeout, setNewStageTimeout] = useState<string>("");
  const [newStageParallelGroup, setNewStageParallelGroup] = useState<string>("__new__");

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }));

  const { data: pipeline, isLoading, error } = useQuery({
    queryKey: queryKeys.pipelines.detail(pipelineId!),
    queryFn: () => pipelinesApi.get(pipelineId!),
    enabled: !!pipelineId,
  });

  const resolvedCompanyId = pipeline?.companyId ?? selectedCompanyId;

  const { data: stages } = useQuery({
    queryKey: queryKeys.pipelines.stages(pipelineId!),
    queryFn: () => pipelinesApi.listStages(pipelineId!),
    enabled: !!pipelineId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(resolvedCompanyId!),
    queryFn: () => agentsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
  });

  const agentMap = new Map((agents ?? []).map((a) => [a.id, a.name]));

  useEffect(() => {
    if (!pipeline?.companyId || pipeline.companyId === selectedCompanyId) return;
    setSelectedCompanyId(pipeline.companyId, { source: "route_sync" });
  }, [pipeline?.companyId, selectedCompanyId, setSelectedCompanyId]);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Pipelines", href: "/pipelines" },
      { label: pipeline?.name ?? pipelineId ?? "Pipeline" },
    ]);
  }, [setBreadcrumbs, pipeline, pipelineId]);

  const updatePipeline = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      pipelinesApi.update(pipelineId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.detail(pipelineId!) });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.list(resolvedCompanyId) });
      }
    },
  });

  useEffect(() => {
    if (pipeline) {
      openPanel(
        <PipelineProperties
          pipeline={pipeline}
          onUpdate={(data) => updatePipeline.mutate(data)}
        />,
      );
    }
    return () => closePanel();
  }, [pipeline]); // eslint-disable-line react-hooks/exhaustive-deps

  const createStage = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      pipelinesApi.createStage(pipelineId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.stages(pipelineId!) });
      setShowAddStage(false);
      resetStageForm();
    },
    onError: (err) => {
      pushToast({ title: "Failed to create stage", body: err.message, tone: "error" });
    },
  });

  const updateStage = useMutation({
    mutationFn: ({ stageId, data }: { stageId: string; data: Record<string, unknown> }) =>
      pipelinesApi.updateStage(stageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.stages(pipelineId!) });
    },
  });

  const deleteStage = useMutation({
    mutationFn: (stageId: string) => pipelinesApi.removeStage(stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.stages(pipelineId!) });
    },
    onError: (err) => {
      pushToast({ title: "Failed to delete stage", body: err.message, tone: "error" });
    },
  });

  function resetStageForm() {
    setNewStageName("");
    setNewStageType("action");
    setNewStageAgentId("__none__");
    setNewStageOnComplete("next");
    setNewStageOnReject("stop");
    setNewStageTimeout("");
    setNewStageParallelGroup("__new__");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !stages) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(stages, oldIndex, newIndex);
    reordered.forEach((stage, i) => {
      if (stage.stageOrder !== i) {
        updateStage.mutate({ stageId: stage.id, data: { stageOrder: i } });
      }
    });
  }

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!pipeline) return null;

  const sortedStages = [...(stages ?? [])].sort((a, b) => a.stageOrder - b.stageOrder);

  // Group stages by stageOrder for parallel display
  const stageGroupMap = new Map<number, PipelineStage[]>();
  for (const s of sortedStages) {
    let g = stageGroupMap.get(s.stageOrder);
    if (!g) { g = []; stageGroupMap.set(s.stageOrder, g); }
    g.push(s);
  }
  const orderedGroups = [...stageGroupMap.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={pipeline.status} />
        </div>

        <InlineEditor
          value={pipeline.name}
          onSave={(name) => updatePipeline.mutate({ name })}
          as="h2"
          className="text-xl font-bold"
        />
      </div>

      {/* Stages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Stages ({sortedStages.length})</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddStage(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Stage
          </Button>
        </div>

        {sortedStages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No stages yet. Add a stage to define the pipeline flow.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {orderedGroups.map(([order, group], gi) => (
                  group.length === 1 ? (
                    <SortableStage
                      key={group[0].id}
                      stage={group[0]}
                      agentName={group[0].agentId ? (agentMap.get(group[0].agentId) ?? group[0].agentId.slice(0, 8)) : null}
                      isLast={gi === orderedGroups.length - 1}
                      onUpdate={(data) => updateStage.mutate({ stageId: group[0].id, data })}
                      onDelete={() => deleteStage.mutate(group[0].id)}
                    />
                  ) : (
                    <div key={`group-${order}`} className="flex items-stretch gap-0">
                      <div className="flex-1 border border-dashed border-muted-foreground/40 rounded-md bg-accent/20 p-2 space-y-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">Parallel Group (order #{order + 1})</span>
                        </div>
                        {group.map((stage) => (
                          <SortableStage
                            key={stage.id}
                            stage={stage}
                            agentName={stage.agentId ? (agentMap.get(stage.agentId) ?? stage.agentId.slice(0, 8)) : null}
                            isLast
                            onUpdate={(data) => updateStage.mutate({ stageId: stage.id, data })}
                            onDelete={() => deleteStage.mutate(stage.id)}
                          />
                        ))}
                      </div>
                      {gi < orderedGroups.length - 1 && (
                        <div className="flex items-center px-1">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add Stage Dialog */}
      <Dialog open={showAddStage} onOpenChange={setShowAddStage}>
        <DialogContent className="sm:max-w-md">
          <h3 className="text-lg font-semibold">Add Stage</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newStageName.trim()) return;
              const timeoutVal = newStageTimeout.trim() ? parseInt(newStageTimeout, 10) : null;
              // Determine stageOrder: use existing group order or append as new group
              let stageOrder: number;
              if (newStageParallelGroup !== "__new__") {
                stageOrder = parseInt(newStageParallelGroup, 10);
              } else {
                // Next order = max existing order + 1, or 0 if none
                const maxOrder = sortedStages.length > 0
                  ? Math.max(...sortedStages.map((s) => s.stageOrder))
                  : -1;
                stageOrder = maxOrder + 1;
              }
              createStage.mutate({
                name: newStageName.trim(),
                stageType: newStageType,
                stageOrder,
                agentId: newStageAgentId === "__none__" ? null : newStageAgentId || null,
                onComplete: newStageOnComplete,
                onReject: newStageOnReject,
                timeoutMinutes: timeoutVal && timeoutVal > 0 ? timeoutVal : null,
              });
            }}
            className="space-y-4 mt-2"
          >
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                autoFocus
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="e.g. Code Review"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Placement</label>
              <Select value={newStageParallelGroup} onValueChange={setNewStageParallelGroup}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">New step (sequential)</SelectItem>
                  {orderedGroups.map(([order, group]) => (
                    <SelectItem key={order} value={String(order)}>
                      Parallel with: {group.map((s) => s.name).join(", ")} (#{order + 1})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={newStageType} onValueChange={setNewStageType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Assigned Agent</label>
              <Select value={newStageAgentId} onValueChange={setNewStageAgentId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No agent (approval stage)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No agent (approval stage)</SelectItem>
                  {(agents ?? []).filter((agent) => agent.id).map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">On Complete</label>
                <Select value={newStageOnComplete} onValueChange={setNewStageOnComplete}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ON_COMPLETE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">On Reject</label>
                <Select value={newStageOnReject} onValueChange={setNewStageOnReject}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ON_REJECT_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Timeout (minutes)</label>
              <input
                type="number"
                min="1"
                value={newStageTimeout}
                onChange={(e) => setNewStageTimeout(e.target.value)}
                placeholder="No timeout"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty for no timeout. Issues exceeding this will be blocked.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddStage(false); resetStageForm(); }}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newStageName.trim() || createStage.isPending}>
                {createStage.isPending ? "Adding..." : "Add Stage"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
