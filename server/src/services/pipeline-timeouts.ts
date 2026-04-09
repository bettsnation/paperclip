import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, issueComments, pipelineRuns, pipelineStages } from "@paperclipai/db";

/**
 * Periodic check for pipeline stage timeouts.
 *
 * Finds running pipeline runs whose current stage has a `timeoutMinutes` set
 * and whose `stageEnteredAt + timeoutMinutes` is in the past. For each,
 * blocks the issue and posts an escalation comment.
 */
export function pipelineTimeoutService(db: Db) {
  return {
    /**
     * Check all active pipeline runs for stage timeouts.
     * Returns the number of issues that were timed out.
     */
    async checkTimeouts(): Promise<{ timedOut: number }> {
      const now = new Date();

      // Find running pipeline runs where stage has a timeout and has exceeded it
      const timedOutRuns = await db
        .select({
          runId: pipelineRuns.id,
          issueId: pipelineRuns.issueId,
          stageId: pipelineRuns.currentStageId,
          stageName: pipelineStages.name,
          stageEnteredAt: pipelineRuns.stageEnteredAt,
          timeoutMinutes: pipelineStages.timeoutMinutes,
        })
        .from(pipelineRuns)
        .innerJoin(pipelineStages, eq(pipelineRuns.currentStageId, pipelineStages.id))
        .where(
          and(
            eq(pipelineRuns.status, "running"),
            isNotNull(pipelineRuns.issueId),
            isNotNull(pipelineRuns.stageEnteredAt),
            isNotNull(pipelineStages.timeoutMinutes),
            lte(
              sql`${pipelineRuns.stageEnteredAt} + (${pipelineStages.timeoutMinutes} || ' minutes')::interval`,
              now,
            ),
          ),
        );

      let timedOut = 0;

      for (const run of timedOutRuns) {
        if (!run.issueId) continue;

        // Check the issue is not already blocked/done/cancelled
        const [issue] = await db
          .select({ id: issues.id, status: issues.status, companyId: issues.companyId, identifier: issues.identifier })
          .from(issues)
          .where(eq(issues.id, run.issueId));

        if (!issue) continue;
        if (issue.status === "blocked" || issue.status === "done" || issue.status === "cancelled") continue;

        // Block the issue
        await db
          .update(issues)
          .set({ status: "blocked", updatedAt: new Date() })
          .where(eq(issues.id, issue.id));

        // Post escalation comment
        const minutes = run.timeoutMinutes!;
        await db.insert(issueComments).values({
          companyId: issue.companyId,
          issueId: issue.id,
          authorAgentId: null,
          authorUserId: null,
          body: `**Stage timeout exceeded** — Stage "${run.stageName}" has exceeded its timeout of ${minutes} minute${minutes === 1 ? "" : "s"}. The issue has been blocked and requires escalation.`,
        });

        // Mark the pipeline run as failed
        await db
          .update(pipelineRuns)
          .set({ status: "failed", stageEnteredAt: null, updatedAt: new Date() })
          .where(eq(pipelineRuns.id, run.runId));

        timedOut++;
      }

      return { timedOut };
    },
  };
}
