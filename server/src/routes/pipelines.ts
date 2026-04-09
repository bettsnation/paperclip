import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createPipelineSchema,
  updatePipelineSchema,
  createPipelineStageSchema,
  updatePipelineStageSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { pipelineService, projectService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

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

  return router;
}
