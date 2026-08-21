import type { Express } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { dailySiteReportComments, dailySiteReports, organisations, siteMembers, sites } from "@shared/schema";
import { users } from "@shared/models/auth";
import { snapshotDailySiteMetrics } from "./daily-site-report-metrics";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const draftSchema = z.object({ siteId: z.coerce.number().int().positive(), reportDate: z.string().regex(datePattern) });
const contentSchema = z.object({ summary: z.string().max(4000).default(""), difficulties: z.string().max(4000).default(""), needs: z.string().max(4000).default(""), handover: z.string().max(4000).default("") });
const commentSchema = z.object({ comment: z.string().trim().min(2).max(2000) });

async function organisationIdFor(req: any) {
  const [user] = await db.select({ organisationId: users.organisationId }).from(users).where(eq(users.id, req.userId)).limit(1);
  return user?.organisationId ?? null;
}

function authorisedSites(req: any): number[] {
  return Array.isArray(req.authorizedSiteIds) ? req.authorizedSiteIds.filter(Number.isInteger) : [];
}

async function canManage(req: any, organisationId: number, siteId: number): Promise<boolean> {
  const [owner] = await db.select({ ownerId: organisations.ownerId }).from(organisations).where(eq(organisations.id, organisationId)).limit(1);
  if (owner?.ownerId === req.userId) return true;
  const [manager] = await db.select({ id: siteMembers.id }).from(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, req.userId), eq(siteMembers.role, "manager"))).limit(1);
  return !!manager;
}

async function scopedReport(req: any, reportId: number) {
  const organisationId = await organisationIdFor(req);
  const siteIds = authorisedSites(req);
  if (!organisationId || !siteIds.length) return null;
  const [report] = await db.select().from(dailySiteReports).where(and(eq(dailySiteReports.id, reportId), eq(dailySiteReports.organisationId, organisationId), inArray(dailySiteReports.siteId, siteIds))).limit(1);
  return report ?? null;
}

export function registerDailySiteReportRoutes(app: Express) {
  app.get("/api/daily-site-reports", isAuthenticated, async (req: any, res) => {
    const organisationId = await organisationIdFor(req);
    let siteIds = Array.isArray(req.siteScope) ? req.siteScope.filter(Number.isInteger) : [];
    const requestedSite = Number(req.query.siteId);
    if (Number.isInteger(requestedSite)) siteIds = authorisedSites(req).includes(requestedSite) ? [requestedSite] : [];
    if (!organisationId || !siteIds.length) return res.json([]);
    const clauses: any[] = [eq(dailySiteReports.organisationId, organisationId), inArray(dailySiteReports.siteId, siteIds)];
    const [organisation] = await db.select({ ownerId: organisations.ownerId }).from(organisations).where(eq(organisations.id, organisationId)).limit(1);
    if (organisation?.ownerId !== req.userId) {
      const managerSiteIds = (await db.select({ siteId: siteMembers.siteId }).from(siteMembers).where(and(eq(siteMembers.userId, req.userId), eq(siteMembers.role, "manager"), inArray(siteMembers.siteId, siteIds)))).map((row) => row.siteId);
      clauses.push(managerSiteIds.length ? or(inArray(dailySiteReports.siteId, managerSiteIds), eq(dailySiteReports.authorUserId, req.userId)) : eq(dailySiteReports.authorUserId, req.userId));
    }
    if (typeof req.query.date === "string" && datePattern.test(req.query.date)) clauses.push(eq(dailySiteReports.reportDate, req.query.date));
    if (["draft", "submitted", "acknowledged"].includes(req.query.status)) clauses.push(eq(dailySiteReports.status, req.query.status));
    const reports = await db.select({ report: dailySiteReports, site: sites }).from(dailySiteReports).innerJoin(sites, eq(dailySiteReports.siteId, sites.id)).where(and(...clauses)).orderBy(desc(dailySiteReports.reportDate), desc(dailySiteReports.version));
    const comments = reports.length ? await db.select().from(dailySiteReportComments).where(and(eq(dailySiteReportComments.organisationId, organisationId), inArray(dailySiteReportComments.reportId, reports.map(({ report }) => report.id)))) : [];
    res.json(reports.map((row) => ({ ...row, comments: comments.filter((item) => item.reportId === row.report.id) })));
  });

  app.post("/api/daily-site-reports/draft", isAuthenticated, async (req: any, res) => {
    const parsed = draftSchema.safeParse(req.body);
    const organisationId = await organisationIdFor(req);
    if (!parsed.success || !organisationId) return res.status(400).json({ message: "Invalid report date or site" });
    const { siteId, reportDate } = parsed.data;
    if (!authorisedSites(req).includes(siteId)) return res.status(403).json({ message: "Site not authorised" });
    const [existing] = await db.select().from(dailySiteReports).where(and(eq(dailySiteReports.siteId, siteId), eq(dailySiteReports.reportDate, reportDate), eq(dailySiteReports.status, "draft"), eq(dailySiteReports.authorUserId, req.userId))).limit(1);
    if (existing) return res.json(existing);
    const metricsSnapshot = await snapshotDailySiteMetrics(siteId, reportDate);
    const [versionRow] = await db.select({ max: sql<number>`coalesce(max(${dailySiteReports.version}), 0)` }).from(dailySiteReports).where(and(eq(dailySiteReports.siteId, siteId), eq(dailySiteReports.reportDate, reportDate)));
    const [created] = await db.insert(dailySiteReports).values({ organisationId, siteId, reportDate, version: Number(versionRow.max) + 1, metricsSnapshot, authorUserId: req.userId }).returning();
    res.status(201).json(created);
  });

  app.patch("/api/daily-site-reports/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id); const parsed = contentSchema.safeParse(req.body); const report = await scopedReport(req, id);
    if (!parsed.success || !report) return res.status(404).json({ message: "Draft not found" });
    if (report.status !== "draft") return res.status(409).json({ message: "Submitted reports are immutable; create an addendum" });
    const organisationId = await organisationIdFor(req);
    if (report.authorUserId !== req.userId && !(await canManage(req, organisationId!, report.siteId))) return res.status(403).json({ message: "Not allowed to edit this draft" });
    const [updated] = await db.update(dailySiteReports).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(dailySiteReports.id, id), eq(dailySiteReports.status, "draft"))).returning();
    res.json(updated);
  });

  app.post("/api/daily-site-reports/:id/submit", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id); const report = await scopedReport(req, id);
    if (!report) return res.status(404).json({ message: "Draft not found" });
    if (report.status !== "draft") return res.status(409).json({ message: "Report already submitted" });
    const organisationId = await organisationIdFor(req);
    if (report.authorUserId !== req.userId && !(await canManage(req, organisationId!, report.siteId))) return res.status(403).json({ message: "Not allowed to submit this draft" });
    const metricsSnapshot = await snapshotDailySiteMetrics(report.siteId, report.reportDate);
    const [updated] = await db.update(dailySiteReports).set({ status: "submitted", metricsSnapshot, submittedAt: new Date(), updatedAt: new Date() }).where(and(eq(dailySiteReports.id, id), eq(dailySiteReports.status, "draft"))).returning();
    if (!updated) return res.status(409).json({ message: "Report status changed" });
    res.json(updated);
  });

  app.post("/api/daily-site-reports/:id/comments", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id); const parsed = commentSchema.safeParse(req.body); const report = await scopedReport(req, id); const organisationId = await organisationIdFor(req);
    if (!parsed.success || !report || !organisationId) return res.status(404).json({ message: "Report not found" });
    const [created] = await db.insert(dailySiteReportComments).values({ reportId: id, organisationId, siteId: report.siteId, authorUserId: req.userId, comment: parsed.data.comment }).returning();
    res.status(201).json(created);
  });

  app.post("/api/daily-site-reports/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id); const report = await scopedReport(req, id); const organisationId = await organisationIdFor(req);
    if (!report || !organisationId) return res.status(404).json({ message: "Report not found" });
    if (!(await canManage(req, organisationId, report.siteId))) return res.status(403).json({ message: "Only a manager or owner can acknowledge a report" });
    if (report.status === "draft") return res.status(409).json({ message: "A draft cannot be acknowledged" });
    const [updated] = await db.update(dailySiteReports).set({ status: "acknowledged", acknowledgedByUserId: req.userId, acknowledgedAt: new Date(), updatedAt: new Date() }).where(eq(dailySiteReports.id, id)).returning();
    res.json(updated);
  });
}
