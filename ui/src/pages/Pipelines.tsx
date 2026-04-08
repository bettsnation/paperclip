import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { GitBranch, Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { pipelinesApi } from "../api/pipelines";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Pipelines() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Pipelines" }]);
  }, [setBreadcrumbs]);

  const { data: pipelines, isLoading, error } = useQuery({
    queryKey: queryKeys.pipelines.list(selectedCompanyId!),
    queryFn: () => pipelinesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createPipeline = useMutation({
    mutationFn: (name: string) =>
      pipelinesApi.create(selectedCompanyId!, { name }),
    onSuccess: (pipeline) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pipelines.list(selectedCompanyId!),
      });
      setShowCreate(false);
      setNewName("");
      navigate(`/pipelines/${pipeline.id}`);
    },
    onError: (err) => {
      pushToast({ title: "Failed to create pipeline", body: err.message, tone: "error" });
    },
  });

  const deletePipeline = useMutation({
    mutationFn: (id: string) => pipelinesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pipelines.list(selectedCompanyId!),
      });
    },
    onError: (err) => {
      pushToast({ title: "Failed to delete pipeline", body: err.message, tone: "error" });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={GitBranch} message="Select a company to view pipelines." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {pipelines && pipelines.length === 0 && (
        <EmptyState
          icon={GitBranch}
          message="No pipelines yet."
          action="New Pipeline"
          onAction={() => setShowCreate(true)}
        />
      )}

      {pipelines && pipelines.length > 0 && (
        <>
          <div className="flex items-center justify-start">
            <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Pipeline
            </Button>
          </div>

          <div className="border border-border rounded-md divide-y divide-border">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/pipelines/${pipeline.id}`)}
              >
                <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pipeline.name}</p>
                </div>
                <StatusBadge status={pipeline.status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon-xs">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePipeline.mutate(pipeline.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <h3 className="text-lg font-semibold">Create Pipeline</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createPipeline.mutate(newName.trim());
            }}
            className="space-y-4 mt-2"
          >
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Code Review Pipeline"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newName.trim() || createPipeline.isPending}>
                {createPipeline.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
