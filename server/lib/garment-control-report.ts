import type { RequestHandler } from "express";
import { reportingDateRange, validReportingTimeZone } from "./reporting-date";

type Queryable = { query: (text: string, values: any[]) => Promise<{ rows: any[] }> };
const controlsSql = `WITH controls AS (
 SELECT o.id AS "orderId", o.order_reference AS "orderReference", o.site_id AS "siteId", s.name AS "siteName",
 g.id AS "garmentItemId", g.item_name AS "itemName", g.quantity AS "registeredQuantity",
 c.phase, c.quantity AS "checkedQuantity", c.checked_at, c.actor_id AS "actorId",
 COALESCE((SELECT NULLIF(e.name,'') FROM employees e WHERE e.user_id=c.actor_id AND e.site_id=o.site_id ORDER BY e.id LIMIT 1),
 NULLIF(concat_ws(' ',u.first_name,u.last_name),''), NULLIF(u.business_name,'')) AS "actorName"
 FROM garment_items g JOIN orders o ON o.id=g.order_id JOIN sites s ON s.id=o.site_id
 CROSS JOIN LATERAL (VALUES ('quality',g.quality_checked_quantity,g.quality_checked_at,g.quality_checked_by),
 ('handover',g.handed_over_quantity,g.handed_over_at,g.handed_over_by)) c(phase,quantity,checked_at,actor_id)
 LEFT JOIN users u ON u.id=c.actor_id AND u.organisation_id=s.organisation_id
 WHERE o.site_id=ANY($1::int[]) AND c.quantity>0 AND c.checked_at BETWEEN $2 AND $3
 AND ($4='all' OR c.phase=$4)
)
 SELECT (SELECT count(*)::int FROM controls) AS total,
 COALESCE((SELECT json_agg(page) FROM (
 SELECT *, to_char(checked_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "checkedAt"
 FROM controls ORDER BY checked_at DESC,"garmentItemId" DESC,phase LIMIT 50 OFFSET $5
 ) page),'[]'::json) AS items`;

// The session's report scope is reused; clients cannot select another tenant's sites.
export function garmentControlReportHandler(db: Queryable, siteScope: (req: any) => number[] | null): RequestHandler {
 return async (req: any,res,next) => {
  const sites=siteScope(req);
  if(sites===null) return void res.status(403).json({message:"Forbidden site"});
  const {start,end,phase="all",page="1"}=req.query;
  const realDate=(s:unknown):s is string => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
  if(!realDate(start)||!realDate(end)||start>end||Date.parse(end)-Date.parse(start)>366*86400000||
   !['all','quality','handover'].includes(phase)||typeof page!=='string'||!/^\d+$/.test(page)||Number(page)<1||Number(page)>100000) {
   return void res.status(400).json({message:"Invalid report filters"});
  }
  if(!sites.length) return void res.json({items:[],total:0,page:Number(page),pageSize:50});
  try {
   const range=reportingDateRange(start,end,validReportingTimeZone(req.get('X-Client-Timezone')));
   const result=await db.query(controlsSql,[sites,range.start,range.end,phase,(Number(page)-1)*50]);
   res.json({...result.rows[0],page:Number(page),pageSize:50});
  } catch(error){next(error);}
 };
}
