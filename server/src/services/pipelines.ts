import { asc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { pipelines, pipelineStages } from "@paperclipai/db";

export function pipelineService(db: Db) {
  return {
    list: (companyId: string) =>
      db.select().from(pipelines).where(eq(pipelines.companyId, companyId)),

    getById: (id: string) =>
      db
        .select()
        .from(pipelines)
        .where(eq(pipelines.id, id))
        .then((rows) => rows[0] ?? null),

    getByProjectId: (projectId: string) =>
      db
        .select()
        .from(pipelines)
        .where(eq(pipelines.projectId, projectId))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof pipelines.$inferInsert, "companyId">) =>
      db
        .insert(pipelines)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof pipelines.$inferInsert>) =>
      db
        .update(pipelines)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(pipelines.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(pipelines)
        .where(eq(pipelines.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // Stage operations
    listStages: (pipelineId: string) =>
      db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipelineId))
        .orderBy(asc(pipelineStages.stageOrder)),

    getStageById: (id: string) =>
      db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.id, id))
        .then((rows) => rows[0] ?? null),

    createStage: (pipelineId: string, data: Omit<typeof pipelineStages.$inferInsert, "pipelineId">) =>
      db
        .insert(pipelineStages)
        .values({ ...data, pipelineId })
        .returning()
        .then((rows) => rows[0]),

    updateStage: (id: string, data: Partial<typeof pipelineStages.$inferInsert>) =>
      db
        .update(pipelineStages)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(pipelineStages.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    removeStage: (id: string) =>
      db
        .delete(pipelineStages)
        .where(eq(pipelineStages.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
