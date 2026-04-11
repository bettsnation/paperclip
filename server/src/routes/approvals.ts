import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { approvals as approvalsTable, issueApprovals, issues } from "@paperclipai/db";
import { inArray } from "drizzle-orm";
import {
  addApprovalCommentSchema,
  createApprovalSchema,
  requestApprovalRevisionSchema,
  resolveApprovalSchema,
  resubmitApprovalSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logger } from "../middleware/logger.js";
import {
  approvalService,
  heartbeatService,
  issueApprovalService,
  issueService,
  logActivity,
  secretService,
} from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { redactEventPayload } from "../redaction.js";
import { notFound, unprocessable } from "../errors.js";

function redactApprovalPayload<T extends { payload: Record<string, unknown> }>(approval: T): T {
  return {
    ...approval,
    payload: redactEventPayload(approval.payload) ?? {},
  };
}

export function approvalRoutes(db: Db) {
  const router = Router();
  const svc = approvalService(db);
  const heartbeat = heartbeatService(db);
  const issueApprovalsSvc = issueApprovalService(db);
  const secretsSvc = secretService(db);
  const issueSvc = issueService(db);
  const strictSecretsMode = process.env.PAPERCLIP_SECRETS_STRICT_MODE === "true";

  router.get("/companies/:companyId/approvals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const status = req.query.status as string | undefined;
    const result = await svc.list(companyId, status);
    res.json(result.map((approval) => redactApprovalPayload(approval)));
  });

  router.get("/approvals/:id", async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    res.json(redactApprovalPayload(approval));
  });

  router.post("/companies/:companyId/approvals", validate(createApprovalSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    // Merge singular issueId into issueIds array
    const rawIssueIds = req.body.issueIds ?? [];
    const issueIds = Array.isArray(rawIssueIds)
      ? rawIssueIds.filter((value: unknown): value is string => typeof value === "string")
      : [];
    if (req.body.issueId) {
      issueIds.push(req.body.issueId);
    }
    const uniqueIssueIds = Array.from(new Set(issueIds));

    const { issueIds: _issueIds, issueId: _issueId, ...approvalInput } = req.body;
    const normalizedPayload =
      approvalInput.type === "hire_agent"
        ? await secretsSvc.normalizeHireApprovalPayloadForPersistence(
            companyId,
            approvalInput.payload,
            { strictMode: strictSecretsMode },
          )
        : approvalInput.payload;

    const actor = getActorInfo(req);

    // Create approval and link issues in a single transaction
    const approval = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(approvalsTable)
        .values({
          companyId,
          ...approvalInput,
          payload: normalizedPayload,
          requestedByUserId: actor.actorType === "user" ? actor.actorId : null,
          requestedByAgentId:
            approvalInput.requestedByAgentId ?? (actor.actorType === "agent" ? actor.actorId : null),
          status: "pending",
          decisionNote: null,
          decidedByUserId: null,
          decidedAt: null,
          updatedAt: new Date(),
        })
        .returning();

      if (uniqueIssueIds.length > 0) {
        // Validate that all issues exist and belong to the same company
        const issueRows = await tx
          .select({ id: issues.id, companyId: issues.companyId })
          .from(issues)
          .where(inArray(issues.id, uniqueIssueIds));

        if (issueRows.length !== uniqueIssueIds.length) {
          throw notFound("One or more issues not found");
        }
        for (const row of issueRows) {
          if (row.companyId !== companyId) {
            throw unprocessable("Issue and approval must belong to the same company");
          }
        }

        await tx
          .insert(issueApprovals)
          .values(
            uniqueIssueIds.map((issueId) => ({
              companyId,
              issueId,
              approvalId: created.id,
              linkedByAgentId: actor.agentId ?? null,
              linkedByUserId: actor.actorType === "user" ? actor.actorId : null,
            })),
          )
          .onConflictDoNothing();
      }

      return created;
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "approval.created",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type, issueIds: uniqueIssueIds },
    });

    res.status(201).json(redactApprovalPayload(approval));
  });

  router.get("/approvals/:id/issues", async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    const issues = await issueApprovalsSvc.listIssuesForApproval(id);
    res.json(issues);
  });

  router.post("/approvals/:id/approve", validate(resolveApprovalSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const { approval, applied } = await svc.approve(
      id,
      req.body.decidedByUserId ?? "board",
      req.body.decisionNote,
    );

    if (applied) {
      const linkedIssues = await issueApprovalsSvc.listIssuesForApproval(approval.id);
      const linkedIssueIds = linkedIssues.map((issue) => issue.id);
      const primaryIssueId = linkedIssueIds[0] ?? null;

      await logActivity(db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "approval.approved",
        entityType: "approval",
        entityId: approval.id,
        details: {
          type: approval.type,
          requestedByAgentId: approval.requestedByAgentId,
          linkedIssueIds,
        },
      });

      // Auto-advance pipeline when a pipeline_stage_approval is approved.
      // Setting the linked issue to "done" triggers evaluatePipelineTransition
      // which advances the pipeline to the next stage.
      if (approval.type === "pipeline_stage_approval") {
        for (const issueId of linkedIssueIds) {
          try {
            await issueSvc.update(issueId, { status: "done" }, db, {
              onPipelineReassignment: (issue) => {
                // Queue a wakeup for the next stage's agent
                if (issue.assigneeAgentId) {
                  heartbeat
                    .wakeup(issue.assigneeAgentId, {
                      source: "automation",
                      triggerDetail: "system",
                      reason: "issue_assigned",
                      payload: { issueId: issue.id },
                      requestedByActorType: "user",
                      requestedByActorId: req.actor.userId ?? "board",
                      contextSnapshot: {
                        source: "pipeline_approval_advance",
                        issueId: issue.id,
                        taskId: issue.id,
                        wakeReason: "issue_assigned",
                      },
                    })
                    .catch((err: unknown) => {
                      logger.warn(
                        { err, issueId: issue.id, agentId: issue.assigneeAgentId },
                        "failed to queue wakeup after pipeline approval advance",
                      );
                    });
                }
              },
            });
          } catch (err) {
            logger.warn(
              { err, approvalId: approval.id, issueId },
              "failed to advance pipeline after approval",
            );
          }
        }
      }

      if (approval.requestedByAgentId) {
        try {
          const wakeRun = await heartbeat.wakeup(approval.requestedByAgentId, {
            source: "automation",
            triggerDetail: "system",
            reason: "approval_approved",
            payload: {
              approvalId: approval.id,
              approvalStatus: approval.status,
              issueId: primaryIssueId,
              issueIds: linkedIssueIds,
            },
            requestedByActorType: "user",
            requestedByActorId: req.actor.userId ?? "board",
            contextSnapshot: {
              source: "approval.approved",
              approvalId: approval.id,
              approvalStatus: approval.status,
              issueId: primaryIssueId,
              issueIds: linkedIssueIds,
              taskId: primaryIssueId,
              wakeReason: "approval_approved",
            },
          });

          await logActivity(db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: req.actor.userId ?? "board",
            action: "approval.requester_wakeup_queued",
            entityType: "approval",
            entityId: approval.id,
            details: {
              requesterAgentId: approval.requestedByAgentId,
              wakeRunId: wakeRun?.id ?? null,
              linkedIssueIds,
            },
          });
        } catch (err) {
          logger.warn(
            {
              err,
              approvalId: approval.id,
              requestedByAgentId: approval.requestedByAgentId,
            },
            "failed to queue requester wakeup after approval",
          );
          await logActivity(db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: req.actor.userId ?? "board",
            action: "approval.requester_wakeup_failed",
            entityType: "approval",
            entityId: approval.id,
            details: {
              requesterAgentId: approval.requestedByAgentId,
              linkedIssueIds,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    }

    res.json(redactApprovalPayload(approval));
  });

  router.post("/approvals/:id/reject", validate(resolveApprovalSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const { approval, applied } = await svc.reject(
      id,
      req.body.decidedByUserId ?? "board",
      req.body.decisionNote,
    );

    if (applied) {
      const linkedIssues = await issueApprovalsSvc.listIssuesForApproval(approval.id);
      const linkedIssueIds = linkedIssues.map((issue) => issue.id);

      await logActivity(db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "approval.rejected",
        entityType: "approval",
        entityId: approval.id,
        details: { type: approval.type, linkedIssueIds },
      });

      // Trigger pipeline rejection when a pipeline_stage_approval is rejected.
      // Setting "changes_requested" triggers evaluatePipelineTransition's rejection path.
      if (approval.type === "pipeline_stage_approval") {
        for (const issueId of linkedIssueIds) {
          try {
            await issueSvc.update(issueId, { status: "changes_requested" }, db, {
              onPipelineReassignment: (issue) => {
                if (issue.assigneeAgentId) {
                  heartbeat
                    .wakeup(issue.assigneeAgentId, {
                      source: "automation",
                      triggerDetail: "system",
                      reason: "issue_assigned",
                      payload: { issueId: issue.id },
                      requestedByActorType: "user",
                      requestedByActorId: req.actor.userId ?? "board",
                      contextSnapshot: {
                        source: "pipeline_approval_rejected",
                        issueId: issue.id,
                        taskId: issue.id,
                        wakeReason: "issue_assigned",
                      },
                    })
                    .catch((err: unknown) => {
                      logger.warn(
                        { err, issueId: issue.id, agentId: issue.assigneeAgentId },
                        "failed to queue wakeup after pipeline approval rejection",
                      );
                    });
                }
              },
            });
          } catch (err) {
            logger.warn(
              { err, approvalId: approval.id, issueId },
              "failed to trigger pipeline rejection after approval rejected",
            );
          }
        }
      }
    }

    res.json(redactApprovalPayload(approval));
  });

  router.post(
    "/approvals/:id/request-revision",
    validate(requestApprovalRevisionSchema),
    async (req, res) => {
      assertBoard(req);
      const id = req.params.id as string;
      const approval = await svc.requestRevision(
        id,
        req.body.decidedByUserId ?? "board",
        req.body.decisionNote,
      );

      await logActivity(db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "approval.revision_requested",
        entityType: "approval",
        entityId: approval.id,
        details: { type: approval.type },
      });

      res.json(redactApprovalPayload(approval));
    },
  );

  router.post("/approvals/:id/resubmit", validate(resubmitApprovalSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);

    if (req.actor.type === "agent" && req.actor.agentId !== existing.requestedByAgentId) {
      res.status(403).json({ error: "Only requesting agent can resubmit this approval" });
      return;
    }

    const normalizedPayload = req.body.payload
      ? existing.type === "hire_agent"
        ? await secretsSvc.normalizeHireApprovalPayloadForPersistence(
            existing.companyId,
            req.body.payload,
            { strictMode: strictSecretsMode },
          )
        : req.body.payload
      : undefined;
    const approval = await svc.resubmit(id, normalizedPayload);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: approval.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "approval.resubmitted",
      entityType: "approval",
      entityId: approval.id,
      details: { type: approval.type },
    });
    res.json(redactApprovalPayload(approval));
  });

  router.get("/approvals/:id/comments", async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    const comments = await svc.listComments(id);
    res.json(comments);
  });

  router.post("/approvals/:id/comments", validate(addApprovalCommentSchema), async (req, res) => {
    const id = req.params.id as string;
    const approval = await svc.getById(id);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    assertCompanyAccess(req, approval.companyId);
    const actor = getActorInfo(req);
    const comment = await svc.addComment(id, req.body.body, {
      agentId: actor.agentId ?? undefined,
      userId: actor.actorType === "user" ? actor.actorId : undefined,
    });

    await logActivity(db, {
      companyId: approval.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "approval.comment_added",
      entityType: "approval",
      entityId: approval.id,
      details: { commentId: comment.id },
    });

    res.status(201).json(comment);
  });

  return router;
}
