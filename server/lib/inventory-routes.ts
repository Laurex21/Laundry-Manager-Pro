import type { Express } from "express";
import { z } from "zod";
import { pool } from "../db";
import { db } from "../db";
import { isAuthenticated } from "../replit_integrations/auth";
import { and, eq } from "drizzle-orm";
import { organisations, siteMembers } from "@shared/schema";

const productSchema = z.object({
  name: z.string().trim().min(2).max(255),
  unit: z.enum(["ml", "l", "g", "kg", "piece"]),
  currentQuantity: z.coerce.number().min(0).max(1_000_000_000).default(0),
  reorderLevel: z.coerce.number().min(0).max(1_000_000_000).default(0),
  unitCost: z.coerce.number().min(0).max(1_000_000_000).default(0),
});

const movementSchema = z.object({
  movementType: z.enum(["receipt", "consumption", "adjustment"]),
  quantity: z.coerce.number().refine((value) => value !== 0 && Number.isFinite(value), "Quantity must be non-zero"),
  productionCycleId: z.coerce.number().int().positive().nullish(),
  notes: z.string().trim().max(1000).optional().default(""),
});

function siteScope(req: any): number[] { return Array.isArray(req.siteScope) ? req.siteScope.filter(Number.isInteger) : []; }

function writeSiteId(req: any): number | null {
  return typeof req.siteId === "number" && siteScope(req).includes(req.siteId) ? req.siteId : null;
}

async function siteRole(req: any, siteId: number): Promise<"owner" | "manager" | "operator" | null> {
  const [organisation] = await db.select({ ownerId: organisations.ownerId }).from(organisations)
    .where(eq(organisations.id, Number(req.organisationId))).limit(1);
  if (organisation?.ownerId === req.userId) return "owner";
  const [membership] = await db.select({ role: siteMembers.role }).from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, req.userId))).limit(1);
  return membership?.role === "manager" || membership?.role === "operator" ? membership.role : null;
}

async function requireManager(req: any, res: any, siteId: number): Promise<boolean> {
  const role = await siteRole(req, siteId);
  if (role === "owner" || role === "manager") return true;
  res.status(403).json({ message: "Insufficient permissions" });
  return false;
}

export function registerInventoryRoutes(app: Express) {
  app.get("/api/inventory/products", isAuthenticated, async (req: any, res) => {
    const sites = siteScope(req);
    if (!sites.length) return res.json([]);
    const result = await pool.query(
      `SELECT p.*, (p.current_quantity <= p.reorder_level) AS "lowStock",
         (p.current_quantity * p.unit_cost)::text AS "stockValue"
       FROM inventory_products p WHERE p.site_id = ANY($1::int[]) AND p.is_active = true
       ORDER BY (p.current_quantity <= p.reorder_level) DESC, p.name`, [sites],
    );
    res.json(result.rows);
  });

  app.post("/api/inventory/products", isAuthenticated, async (req: any, res) => {
    const parsed = productSchema.safeParse(req.body);
    const siteId = writeSiteId(req);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid product" });
    if (siteId === null) return res.status(400).json({ message: "Select a specific site before saving" });
    if (!(await requireManager(req, res, siteId))) return;
    const organisationId = Number(req.organisationId);
    if (!Number.isInteger(organisationId)) return res.status(403).json({ message: "Organisation context required" });
    const result = await pool.query(
      `INSERT INTO inventory_products (organisation_id, site_id, name, unit, current_quantity, reorder_level, unit_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [organisationId, siteId, parsed.data.name, parsed.data.unit, parsed.data.currentQuantity, parsed.data.reorderLevel, parsed.data.unitCost],
    );
    res.status(201).json(result.rows[0]);
  });

  app.post("/api/inventory/products/:id/movements", isAuthenticated, async (req: any, res) => {
    const productId = Number(req.params.id);
    const parsed = movementSchema.safeParse(req.body);
    if (!Number.isInteger(productId) || !parsed.success) return res.status(400).json({ message: parsed.success ? "Invalid product" : parsed.error.errors[0]?.message });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const productResult = await client.query(`SELECT * FROM inventory_products WHERE id=$1 AND site_id=ANY($2::int[]) FOR UPDATE`, [productId, siteScope(req)]);
      const product = productResult.rows[0];
      if (!product) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Product not found" }); }
      const role = await siteRole(req, product.site_id);
      if (!role || (parsed.data.movementType !== "consumption" && role === "operator")) {
        await client.query("ROLLBACK"); return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (parsed.data.productionCycleId) {
        const cycle = await client.query(`SELECT id FROM production_cycles WHERE id=$1 AND site_id=$2`, [parsed.data.productionCycleId, product.site_id]);
        if (!cycle.rowCount) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Cycle does not belong to this site" }); }
      }
      if (parsed.data.movementType === "receipt" && parsed.data.quantity < 0) {
        await client.query("ROLLBACK"); return res.status(400).json({ message: "Receipt quantity must be positive" });
      }
      const signedQuantity = parsed.data.movementType === "consumption" ? -Math.abs(parsed.data.quantity) : parsed.data.quantity;
      const nextQuantity = Number(product.current_quantity) + signedQuantity;
      if (nextQuantity < 0) { await client.query("ROLLBACK"); return res.status(409).json({ message: "Insufficient stock" }); }
      await client.query(`UPDATE inventory_products SET current_quantity=$2, updated_at=NOW() WHERE id=$1`, [productId, nextQuantity]);
      const movement = await client.query(
        `INSERT INTO inventory_movements (product_id, organisation_id, site_id, production_cycle_id, movement_type, quantity, unit_cost, notes, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [productId, product.organisation_id, product.site_id, parsed.data.productionCycleId || null, parsed.data.movementType, signedQuantity, product.unit_cost, parsed.data.notes || null, req.userId],
      );
      await client.query("COMMIT");
      res.status(201).json({ movement: movement.rows[0], currentQuantity: String(nextQuantity) });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  });

  app.get("/api/inventory/summary", isAuthenticated, async (req: any, res) => {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS "productCount",
         COUNT(*) FILTER (WHERE current_quantity <= reorder_level)::int AS "lowStockCount",
         COALESCE(SUM(current_quantity * unit_cost),0)::text AS "stockValue",
         COALESCE((SELECT SUM(ABS(im.quantity) * im.unit_cost)
           FROM inventory_movements im
           WHERE im.site_id=ANY($1::int[]) AND im.movement_type='consumption'
             AND im.created_at >= date_trunc('month', NOW())),0)::text AS "consumptionCostThisMonth"
       FROM inventory_products WHERE site_id=ANY($1::int[]) AND is_active=true`, [siteScope(req)],
    );
    res.json(result.rows[0]);
  });

  app.get("/api/inventory/movements", isAuthenticated, async (req: any, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const result = await pool.query(
      `SELECT im.id, im.movement_type AS "movementType", im.quantity, im.unit_cost AS "unitCost",
         im.production_cycle_id AS "productionCycleId", im.notes, im.created_at AS "createdAt",
         p.name AS "productName", p.unit
       FROM inventory_movements im
       JOIN inventory_products p ON p.id=im.product_id
       WHERE im.site_id=ANY($1::int[])
       ORDER BY im.created_at DESC LIMIT $2`,
      [siteScope(req), limit],
    );
    res.json(result.rows);
  });
}
