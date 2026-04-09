import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { approvalDecisions, approvals, issues, issueApprovals, issueComments, pipelineRuns, pipelineStages } from "@paperclipai/db";
import {
  createPipelineSchema,
  updatePipelineSchema,
  createPipelineStageSchema,
  updatePipelineStageSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { pipelineService, projectService, logActivity, groupStagesByOrder } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { conflict, notFound, unprocessable } from "../errors.js";

export function pipelineRoutes(db: Db) {
  const router = Router();
  const svc = pipelineService(db);
  const projectSvc = projectService(db);

  // --- Pipeline CRUD ---

  router.get("/companies/:companyId/pipelines", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  router.post("/companies/:companyId/pipelines", validate(createPipelineSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const pipeline = await svc.create(companyId, req.body);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline.created",
      entityType: "pipeline",
      entityId: pipeline.id,
      details: { name: pipeline.name },
    });

    res.status(201).json(pipeline);
  });

  router.get("/pipelines/:id", async (req, res) => {
    const id = req.params.id as string;
    const pipeline = await svc.getById(id);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    res.json(pipeline);
  });

  router.patch("/pipelines/:id", validate(updatePipelineSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const pipeline = await svc.update(id, req.body);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: pipeline.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline.updated",
      entityType: "pipeline",
      entityId: pipeline.id,
      details: req.body,
    });

    res.json(pipeline);
  });

  router.delete("/pipelines/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const pipeline = await svc.remove(id);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: pipeline.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline.deleted",
      entityType: "pipeline",
      entityId: pipeline.id,
    });

    res.json(pipeline);
  });

  // --- Project pipeline attachment ---

  router.get("/projects/:projectId/pipeline", async (req, res) => {
    const projectId = req.params.projectId as string;
    const pipeline = await svc.getByProjectId(projectId);
    if (!pipeline) {
      res.status(404).json({ error: "No pipeline attached to this project" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    res.json(pipeline);
  });

  router.post("/projects/:projectId/pipeline", validate(createPipelineSchema), async (req, res) => {
    const projectId = req.params.projectId as string;
    const project = await projectSvc.getById(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    assertCompanyAccess(req, project.companyId);

    const existing = await svc.getByProjectId(projectId);
    if (existing) {
      res.status(409).json({ error: "Project already has a pipeline attached" });
      return;
    }

    const pipeline = await svc.create(project.companyId, {
      ...req.body,
      projectId,
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: project.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline.created",
      entityType: "pipeline",
      entityId: pipeline.id,
      details: { name: pipeline.name, projectId },
    });

    res.status(201).json(pipeline);
  });

  router.delete("/projects/:projectId/pipeline", async (req, res) => {
    const projectId = req.params.projectId as string;
    const pipeline = await svc.getByProjectId(projectId);
    if (!pipeline) {
      res.status(404).json({ error: "No pipeline attached to this project" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    await svc.update(pipeline.id, { projectId: null });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: pipeline.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline.detached",
      entityType: "pipeline",
      entityId: pipeline.id,
      details: { projectId },
    });

    res.json({ ok: true });
  });

  // --- Stage CRUD ---

  router.get("/pipelines/:pipelineId/stages", async (req, res) => {
    const pipelineId = req.params.pipelineId as string;
    const pipeline = await svc.getById(pipelineId);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    const stages = await svc.listStages(pipelineId);
    res.json(stages);
  });

  router.post("/pipelines/:pipelineId/stages", validate(createPipelineStageSchema), async (req, res) => {
    const pipelineId = req.params.pipelineId as string;
    const pipeline = await svc.getById(pipelineId);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    const stage = await svc.createStage(pipelineId, req.body);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: pipeline.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline_stage.created",
      entityType: "pipeline_stage",
      entityId: stage.id,
      details: { name: stage.name, pipelineId },
    });

    res.status(201).json(stage);
  });

  router.get("/pipeline-stages/:id", async (req, res) => {
    const id = req.params.id as string;
    const stage = await svc.getStageById(id);
    if (!stage) {
      res.status(404).json({ error: "Pipeline stage not found" });
      return;
    }
    const pipeline = await svc.getById(stage.pipelineId);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    res.json(stage);
  });

  router.patch("/pipeline-stages/:id", validate(updatePipelineStageSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getStageById(id);
    if (!existing) {
      res.status(404).json({ error: "Pipeline stage not found" });
      return;
    }
    const pipeline = await svc.getById(existing.pipelineId);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    const stage = await svc.updateStage(id, req.body);
    if (!stage) {
      res.status(404).json({ error: "Pipeline stage not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: pipeline.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline_stage.updated",
      entityType: "pipeline_stage",
      entityId: stage.id,
      details: req.body,
    });

    res.json(stage);
  });

  router.delete("/pipeline-stages/:id", async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getStageById(id);
    if (!existing) {
      res.status(404).json({ error: "Pipeline stage not found" });
      return;
    }
    const pipeline = await svc.getById(existing.pipelineId);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline not found" });
      return;
    }
    assertCompanyAccess(req, pipeline.companyId);
    const stage = await svc.removeStage(id);
    if (!stage) {
      res.status(404).json({ error: "Pipeline stage not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: pipeline.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "pipeline_stage.deleted",
      entityType: "pipeline_stage",
      entityId: stage.id,
    });

    res.json(stage);
  });

  // --- Pipeline run for issue ---

  router.get("/issues/:issueId/pipeline-run", async (req, res) => {
    const issueId = req.params.issueId as string;
    const [issue] = await db
      .select({ companyId: issues.companyId })
      .from(issues)
      .where(eq(issues.id, issueId));
    if (!issue) {
      res.status(404).json({ error: "Issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);

    const [run] = await db
      .select()
      .from(pipelineRuns)
      .where(and(eq(pipelineRuns.issueId, issueId), eq(pipelineRuns.status, "running")));

    if (!run) {
      res.status(404).json({ error: "No running pipeline run for this issue" });
      return;
    }
    res.json(run);
  });

  // --- Skip stage (board override) ---

  router.post("/pipeline-runs/:id/skip-stage", async (req, res) => {
    assertBoard(req);

    const runId = req.params.id as string;
    const { reason } = req.body as { reason?: string };
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      throw unprocessable("A reason is required to skip a stage");
    }

    const result = await db.transaction(async (tx) => {
      // 1. Load the pipeline run
      const [run] = await tx
        .select()
        .from(pipelineRuns)
        .where(and(eq(pipelineRuns.id, runId), eq(pipelineRuns.status, "running")));
      if (!run) throw notFound("Running pipeline run not found");

      if (!run.currentStageId) throw conflict("Pipeline run has no current stage");

      // 2. Load the current stage
      const [currentStage] = await tx
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.id, run.currentStageId));
      if (!currentStage) throw notFound("Current pipeline stage not found");

      // 3. Cannot skip approval or sub_pipeline stages
      if (currentStage.stageType === "approval") {
        throw conflict("Cannot skip approval stages");
      }
      if (currentStage.stageType === "sub_pipeline") {
        throw conflict("Cannot skip sub-pipeline stages");
      }

      // 4. Get all stages in order
      const allStages = await tx
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, run.pipelineId))
        .orderBy(asc(pipelineStages.stageOrder));

      const actor = getActorInfo(req);
      const now = new Date();
      const skipEntry = {
        action: "stage_skipped",
        stageId: currentStage.id,
        stageName: currentStage.name,
        stageType: currentStage.stageType,
        reason: reason.trim(),
        skippedBy: actor.actorId,
        skippedAt: now.toISOString(),
      };

      // Append skip event and mark stage completed in stateJson
      const existingState = (run.stateJson ?? {}) as Record<string, unknown>;
      const skipLog = Array.isArray(existingState.skipLog) ? [...existingState.skipLog] : [];
      skipLog.push(skipEntry);
      const prevCompleted: string[] = Array.isArray(existingState.completedStageIds)
        ? existingState.completedStageIds as string[]
        : [];
      const completedStageIds = [...new Set([...prevCompleted, currentStage.id])];
      const newStateJson = { ...existingState, skipLog, completedStageIds };

      // 5. Group stages by stageOrder for parallel support
      const groups = groupStagesByOrder(allStages);
      const currentGroupIdx = groups.findIndex((g) => g.some((s) => s.id === currentStage.id));
      const currentGroup = groups[currentGroupIdx];

      // Check if all stages in the parallel group are now done
      const completedSet = new Set(completedStageIds);
      const allGroupDone = currentGroup.every((s) => completedSet.has(s.id));
      const isComplete = allGroupDone && currentGroupIdx >= groups.length - 1;

      let advancedToName: string | null = null;

      if (isComplete) {
        // Last group — pipeline completes
        await tx
          .update(pipelineRuns)
          .set({ status: "completed", stateJson: newStateJson, updatedAt: now })
          .where(eq(pipelineRuns.id, run.id));

        if (run.issueId) {
          await tx
            .update(issues)
            .set({ status: "done", completedAt: now, updatedAt: now })
            .where(eq(issues.id, run.issueId));
        }
      } else {
        // Next stage: next unfinished in group, or first in next group
        let nextStage: typeof allStages[number];
        if (!allGroupDone) {
          nextStage = currentGroup.find((s) => !completedSet.has(s.id))!;
        } else {
          nextStage = groups[currentGroupIdx + 1][0];
        }
        advancedToName = nextStage.name;

        const nextStatus = nextStage.stageType === "review" || nextStage.stageType === "approval"
          ? "in_review"
          : "todo";

        await tx
          .update(pipelineRuns)
          .set({ currentStageId: nextStage.id, stateJson: newStateJson, updatedAt: now })
          .where(eq(pipelineRuns.id, run.id));

        if (run.issueId) {
          const issuePatch: Record<string, unknown> = { status: nextStatus, updatedAt: now };
          if (nextStage.agentId) {
            issuePatch.assigneeAgentId = nextStage.agentId;
          }
          await tx
            .update(issues)
            .set(issuePatch)
            .where(eq(issues.id, run.issueId));
        }
      }

      // 6. Post issue comment
      if (run.issueId) {
        const issueRow = await tx
          .select({ companyId: issues.companyId })
          .from(issues)
          .where(eq(issues.id, run.issueId))
          .then((rows) => rows[0]);

        if (issueRow) {
          const commentBody = isComplete
            ? `**Stage skipped (board override):** "${currentStage.name}" was skipped. Pipeline completed.\n\n**Reason:** ${reason.trim()}`
            : `**Stage skipped (board override):** "${currentStage.name}" was skipped. Advanced to "${advancedToName}".\n\n**Reason:** ${reason.trim()}`;

          await tx.insert(issueComments).values({
            companyId: issueRow.companyId,
            issueId: run.issueId,
            authorUserId: actor.actorId,
            body: commentBody,
          });

          await tx
            .update(issues)
            .set({ updatedAt: now })
            .where(eq(issues.id, run.issueId));
        }
      }

      // 7. Log activity
      if (run.issueId) {
        const issueRow = await tx
          .select({ companyId: issues.companyId })
          .from(issues)
          .where(eq(issues.id, run.issueId))
          .then((rows) => rows[0]);

        if (issueRow) {
          await logActivity(db, {
            companyId: issueRow.companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            action: "pipeline_stage.skipped",
            entityType: "pipeline_run",
            entityId: run.id,
            details: skipEntry,
          });
        }
      }

      // Return the updated run
      const [updatedRun] = await tx
        .select()
        .from(pipelineRuns)
        .where(eq(pipelineRuns.id, run.id));

      return updatedRun;
    });

    res.json(result);
  });

  // --- Multi-approver: approval decisions ---

  router.get("/approvals/:id/decisions", async (req, res) => {
    const approvalId = req.params.id as string;
    const [approval] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, approvalId));
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);

    const decisions = await db
      .select()
      .from(approvalDecisions)
      .where(eq(approvalDecisions.approvalId, approvalId))
      .orderBy(asc(approvalDecisions.createdAt));

    res.json(decisions);
  });

  router.post("/approvals/:id/decisions", async (req, res) => {
    assertBoard(req);

    const approvalId = req.params.id as string;
    const { decision, comment } = req.body as { decision?: string; comment?: string };

    if (!decision || !["approve", "reject"].includes(decision)) {
      throw unprocessable("decision must be 'approve' or 'reject'");
    }

    const result = await db.transaction(async (tx) => {
      const [approval] = await tx
        .select()
        .from(approvals)
        .where(eq(approvals.id, approvalId));
      if (!approval) throw notFound("Approval not found");
      assertCompanyAccess(req, approval.companyId);

      if (approval.status !== "pending") {
        throw conflict("Approval is no longer pending");
      }

      const actor = getActorInfo(req);

      // Record the individual decision
      const [decisionRow] = await tx
        .insert(approvalDecisions)
        .values({
          approvalId,
          agentId: actor.agentId ?? null,
          userId: actor.actorId,
          decision,
          comment: comment?.trim() || null,
        })
        .returning();

      // If rejection, immediately fail the approval
      if (decision === "reject") {
        await tx
          .update(approvals)
          .set({
            status: "rejected",
            decidedByUserId: actor.actorId,
            decisionNote: comment?.trim() || "Rejected via multi-approver vote",
            updatedAt: new Date(),
          })
          .where(eq(approvals.id, approvalId));

        // Advance pipeline — find linked issue and handle rejection
        const linkedIssues = await tx
          .select({ issueId: issueApprovals.issueId })
          .from(issueApprovals)
          .where(eq(issueApprovals.approvalId, approvalId));

        for (const { issueId } of linkedIssues) {
          const [run] = await tx
            .select()
            .from(pipelineRuns)
            .where(and(eq(pipelineRuns.issueId, issueId), eq(pipelineRuns.status, "running")));

          if (run) {
            await tx
              .update(pipelineRuns)
              .set({ status: "failed", updatedAt: new Date() })
              .where(eq(pipelineRuns.id, run.id));

            await tx
              .update(issues)
              .set({ status: "blocked", updatedAt: new Date() })
              .where(eq(issues.id, issueId));
          }
        }

        const [updated] = await tx
          .select()
          .from(approvals)
          .where(eq(approvals.id, approvalId));
        return { approval: updated, decision: decisionRow, resolved: true };
      }

      // For approve, count existing approvals to see if threshold met
      const payload = (approval.payload ?? {}) as Record<string, unknown>;
      const requiredCount = (typeof payload.approverCount === "number" ? payload.approverCount : 1);

      const existingApprovals = await tx
        .select()
        .from(approvalDecisions)
        .where(and(
          eq(approvalDecisions.approvalId, approvalId),
          eq(approvalDecisions.decision, "approve"),
        ));

      if (existingApprovals.length >= requiredCount) {
        // Threshold met — resolve the approval as approved
        await tx
          .update(approvals)
          .set({
            status: "approved",
            decidedByUserId: actor.actorId,
            decisionNote: `Approved with ${existingApprovals.length}/${requiredCount} votes`,
            updatedAt: new Date(),
          })
          .where(eq(approvals.id, approvalId));

        // Advance pipeline — find linked issue and resolve the approval stage as done
        const linkedIssues = await tx
          .select({ issueId: issueApprovals.issueId })
          .from(issueApprovals)
          .where(eq(issueApprovals.approvalId, approvalId));

        for (const { issueId } of linkedIssues) {
          const [run] = await tx
            .select()
            .from(pipelineRuns)
            .where(and(eq(pipelineRuns.issueId, issueId), eq(pipelineRuns.status, "running")));

          if (run && run.currentStageId) {
            const [currentStage] = await tx
              .select()
              .from(pipelineStages)
              .where(eq(pipelineStages.id, run.currentStageId));

            if (currentStage && currentStage.stageType === "approval") {
              // Setting the issue to "done" triggers evaluatePipelineTransition() on the
              // next status-change path (issue update service), which resolves the approval
              // stage and advances the pipeline to the next stage. This indirect approach
              // reuses the existing pipeline engine logic rather than duplicating it here.
              await tx
                .update(issues)
                .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
                .where(eq(issues.id, issueId));
            }
          }
        }

        const [updated] = await tx
          .select()
          .from(approvals)
          .where(eq(approvals.id, approvalId));
        return { approval: updated, decision: decisionRow, resolved: true };
      }

      // Not yet at threshold
      const [updated] = await tx
        .select()
        .from(approvals)
        .where(eq(approvals.id, approvalId));
      return { approval: updated, decision: decisionRow, resolved: false };
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: result.approval.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: `approval_decision.${decision}`,
      entityType: "approval",
      entityId: approvalId,
      details: { decision, resolved: result.resolved },
    });

    res.status(201).json(result);
  });

  return router;
}
