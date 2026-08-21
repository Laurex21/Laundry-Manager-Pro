import type { Express } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import {
  customers,
  garmentItems,
  garmentReturnAttachments,
  garmentReturnCases,
  garmentReturnEvents,
  orders,
  organisations,
  siteMembers,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import {
  assignedStageForDecision,
  canTransitionReturn,
  COMPLAINT_REASONS,
  requiresDecisionJustification,
  RETURN_DECISIONS,
  RETURN_STATUSES,
  validateEvidenceImages,
} from "./garment-return-rules";

const createSchema = z.object({
  garmentItemIds: z.array(z.coerce.number().int().positive()).min(1).max(50),
  complaintReason: z.enum(COMPLAINT_REASONS),
  customerComment: z.string().trim().min(3).max(2_000),
  images: z.unknown().optional(),
});

const decisionSchema = z.object({
  decision: z.enum(RETURN_DECISIONS),
  notes: z.string().trim().max(2_000).optional().default(""),
});

const transitionSchema = z.object({
  toStatus: z.enum(RETURN_STATUSES),
  notes: z.string().trim().min(2).max(2_000),
});

function allowedSites(req: any, organisationWide = false): number[] {
  const source = organisationWide ? req.authorizedSiteIds : req.siteScope;
  return Array.isArray(source) ? source.filter(Number.isInteger) : [];
}

async function organisationIdFor(req: any): Promise<number | null> {
  const [user] = await db.select({ organisationId: users.organisationId })
    .from(users).where(eq(users.id, req.userId)).limit(1);
  return user?.organisationId ?? null;
}

async function requireManagerOrOwner(req: any, res: any, organisationId: number, siteId: number): Promise<boolean> {
  const [organisation] = await db.select({ ownerId: organisations.ownerId })
    .from(organisations).where(eq(organisations.id, organisationId)).limit(1);
  if (organisation?.ownerId === req.userId) return true;
  const [membership] = await db.select({ id: siteMembers.id }).from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, req.userId), eq(siteMembers.role, "manager"))).limit(1);
  if (membership) return true;
  res.status(403).json({ message: "Only a manager or owner can make this return decision" });
  return false;
}

async function caseInScope(caseId: number, organisationId: number, siteIds: number[]) {
  if (!siteIds.length) return null;
  const [row] = await db.select().from(garmentReturnCases).where(and(
    eq(garmentReturnCases.id, caseId),
    eq(garmentReturnCases.organisationId, organisationId),
    inArray(garmentReturnCases.siteId, siteIds),
  )).limit(1);
  return row ?? null;
}

async function detailedCases(where: any) {
  const rows = await db.select({
    returnCase: garmentReturnCases,
    garment: garmentItems,
    order: orders,
    customer: customers,
  }).from(garmentReturnCases)
    .innerJoin(garmentItems, eq(garmentReturnCases.garmentItemId, garmentItems.id))
    .innerJoin(orders, eq(garmentReturnCases.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(garmentReturnCases.createdAt));
  if (!rows.length) return [];
  const attachments = await db.select().from(garmentReturnAttachments).where(and(
    inArray(garmentReturnAttachments.returnCaseId, rows.map((row) => row.returnCase.id)),
    eq(garmentReturnAttachments.organisationId, rows[0].returnCase.organisationId),
  ));
  return rows.map((row) => ({
    ...row,
    attachments: attachments.filter((attachment) => attachment.returnCaseId === row.returnCase.id),
  }));
}

export function registerGarmentReturnRoutes(app: Express) {
  app.post("/api/orders/:orderId/garment-returns", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    const orderId = Number(req.params.orderId);
    const parsed = createSchema.safeParse(req.body);
    if (!organisationId || !Number.isInteger(orderId)) return res.status(400).json({ message: "Invalid order" });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid return" });
    let images;
    try { images = validateEvidenceImages(parsed.data.images); }
    catch (error) { return res.status(400).json({ message: (error as Error).message }); }
    const allowedSiteIds = allowedSites(req, true);
    if (!allowedSiteIds.length) return res.status(403).json({ message: "No authorised site" });
    const [order] = await db.select().from(orders).where(and(
      eq(orders.id, orderId),
      eq(orders.status, "delivered"),
      inArray(orders.siteId, allowedSiteIds),
    )).limit(1);
    if (!order?.siteId) return res.status(404).json({ message: "Delivered order not found" });
    const uniqueGarmentIds = [...new Set(parsed.data.garmentItemIds)];
    const garments = await db.select().from(garmentItems).where(and(
      eq(garmentItems.orderId, orderId),
      inArray(garmentItems.id, uniqueGarmentIds),
    ));
    if (garments.length !== uniqueGarmentIds.length) return res.status(400).json({ message: "One or more garments do not belong to this order" });
    try {
      const created = await db.transaction(async (tx) => {
        const results = [];
        for (const garment of garments) {
          const [returnCase] = await tx.insert(garmentReturnCases).values({
            organisationId,
            siteId: order.siteId!,
            orderId,
            garmentItemId: garment.id,
            complaintReason: parsed.data.complaintReason,
            customerComment: parsed.data.customerComment,
            receivedByUserId: req.userId,
          }).returning();
          await tx.insert(garmentReturnEvents).values({
            returnCaseId: returnCase.id,
            organisationId,
            siteId: order.siteId!,
            eventType: "received",
            toStatus: "pending_review",
            notes: parsed.data.customerComment,
            actorUserId: req.userId,
          });
          if (images.length) await tx.insert(garmentReturnAttachments).values(images.map((image) => ({
            returnCaseId: returnCase.id,
            organisationId,
            siteId: order.siteId!,
            mimeType: image.mimeType,
            sizeBytes: image.sizeBytes,
            dataUrl: image.dataUrl,
            addedByUserId: req.userId,
          })));
          results.push(returnCase);
        }
        return results;
      });
      res.status(201).json({ returns: created });
    } catch (error: any) {
      if (error?.code === "23505") return res.status(409).json({ message: "One of these garments already has an active return" });
      throw error;
    }
  });

  app.get("/api/orders/:orderId/garment-returns", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    const orderId = Number(req.params.orderId);
    const allowedSiteIds = allowedSites(req, true);
    if (!organisationId || !Number.isInteger(orderId) || !allowedSiteIds.length) return res.status(404).json({ message: "Order not found" });
    const rows = await detailedCases(and(
      eq(garmentReturnCases.organisationId, organisationId),
      eq(garmentReturnCases.orderId, orderId),
      inArray(garmentReturnCases.siteId, allowedSiteIds),
    ));
    res.json(rows);
  });

  app.get("/api/garment-returns", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    let siteIds = allowedSites(req);
    if (!organisationId || !siteIds.length) return res.json([]);
    const siteId = Number(req.query.siteId);
    if (Number.isInteger(siteId)) siteIds = siteIds.includes(siteId) ? [siteId] : [];
    if (!siteIds.length) return res.status(403).json({ message: "Site not authorised" });
    const clauses: any[] = [eq(garmentReturnCases.organisationId, organisationId), inArray(garmentReturnCases.siteId, siteIds)];
    if (req.query.status && RETURN_STATUSES.includes(req.query.status)) clauses.push(eq(garmentReturnCases.status, req.query.status));
    res.json(await detailedCases(and(...clauses)));
  });

  app.post("/api/garment-returns/:id/decision", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    const id = Number(req.params.id);
    const parsed = decisionSchema.safeParse(req.body);
    if (!organisationId || !Number.isInteger(id)) return res.status(400).json({ message: "Invalid return" });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid decision" });
    const current = await caseInScope(id, organisationId, allowedSites(req, true));
    if (!current) return res.status(404).json({ message: "Return not found" });
    if (!(await requireManagerOrOwner(req, res, organisationId, current.siteId))) return;
    if (current.status !== "pending_review") return res.status(409).json({ message: "This return has already been reviewed" });
    if (requiresDecisionJustification(parsed.data.decision) && parsed.data.notes.length < 3) return res.status(400).json({ message: "A justification is required for this decision" });
    const toStatus = parsed.data.decision === "reject" ? "rejected" : "approved";
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(garmentReturnCases).set({
        status: toStatus,
        decision: parsed.data.decision,
        assignedStage: assignedStageForDecision(parsed.data.decision),
        decisionNotes: parsed.data.notes || null,
        decidedByUserId: req.userId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(garmentReturnCases.id, id),
        eq(garmentReturnCases.organisationId, organisationId),
        eq(garmentReturnCases.status, "pending_review"),
      )).returning();
      if (!updated) return null;
      await tx.insert(garmentReturnEvents).values({
        returnCaseId: id, organisationId, siteId: current.siteId, eventType: "decision",
        fromStatus: "pending_review", toStatus, notes: parsed.data.notes || parsed.data.decision, actorUserId: req.userId,
      });
      return updated;
    });
    if (!result) return res.status(409).json({ message: "Return status changed; refresh and try again" });
    res.json(result);
  });

  app.post("/api/garment-returns/:id/transition", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    const id = Number(req.params.id);
    const parsed = transitionSchema.safeParse(req.body);
    if (!organisationId || !Number.isInteger(id)) return res.status(400).json({ message: "Invalid return" });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid transition" });
    const current = await caseInScope(id, organisationId, allowedSites(req, true));
    if (!current) return res.status(404).json({ message: "Return not found" });
    if (!(await requireManagerOrOwner(req, res, organisationId, current.siteId))) return;
    if (!canTransitionReturn(current.status, parsed.data.toStatus)) return res.status(409).json({ message: `Cannot move a return from ${current.status} to ${parsed.data.toStatus}` });
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(garmentReturnCases).set({
        status: parsed.data.toStatus,
        resolvedByUserId: parsed.data.toStatus === "resolved" ? req.userId : current.resolvedByUserId,
        resolvedAt: parsed.data.toStatus === "resolved" ? new Date() : current.resolvedAt,
        updatedAt: new Date(),
      }).where(and(
        eq(garmentReturnCases.id, id),
        eq(garmentReturnCases.organisationId, organisationId),
        eq(garmentReturnCases.status, current.status),
      )).returning();
      if (!updated) return null;
      await tx.insert(garmentReturnEvents).values({
        returnCaseId: id, organisationId, siteId: current.siteId, eventType: "status_changed",
        fromStatus: current.status, toStatus: parsed.data.toStatus, notes: parsed.data.notes, actorUserId: req.userId,
      });
      return updated;
    });
    if (!result) return res.status(409).json({ message: "Return status changed; refresh and try again" });
    res.json(result);
  });

  app.get("/api/garment-returns/:id/events", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    const id = Number(req.params.id);
    if (!organisationId || !Number.isInteger(id)) return res.status(400).json({ message: "Invalid return" });
    const current = await caseInScope(id, organisationId, allowedSites(req, true));
    if (!current) return res.status(404).json({ message: "Return not found" });
    const events = await db.select().from(garmentReturnEvents).where(and(
      eq(garmentReturnEvents.returnCaseId, id),
      eq(garmentReturnEvents.organisationId, organisationId),
      eq(garmentReturnEvents.siteId, current.siteId),
    )).orderBy(garmentReturnEvents.createdAt);
    res.json(events);
  });
}
