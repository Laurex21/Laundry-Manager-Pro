import { db } from "../server/db";
import {
  customers,
  expenditures,
  orders,
  payments,
  services,
  sites,
  siteMembers,
  organisations,
} from "../shared/schema";
import { users } from "../shared/models/auth";
import { eq, sql } from "drizzle-orm";

async function countsBySite(table: any, siteColumn: any) {
  return await db
    .select({
      siteId: siteColumn,
      count: sql<number>`count(*)::int`,
    })
    .from(table)
    .groupBy(siteColumn)
    .orderBy(siteColumn);
}

async function main() {
  const [
    userRows,
    orgRows,
    siteRows,
    memberRows,
    customerCounts,
    orderCounts,
    serviceCounts,
    expenseCounts,
    paymentCount,
  ] = await Promise.all([
    db.select().from(users).orderBy(users.createdAt),
    db.select().from(organisations).orderBy(organisations.id),
    db.select().from(sites).orderBy(sites.id),
    db.select().from(siteMembers).orderBy(siteMembers.siteId),
    countsBySite(customers, customers.siteId),
    countsBySite(orders, orders.siteId),
    countsBySite(services, services.siteId),
    countsBySite(expenditures, expenditures.siteId),
    db.select({ count: sql<number>`count(*)::int` }).from(payments),
  ]);

  const memberBySite = new Map<number, typeof memberRows>();
  for (const member of memberRows) {
    const list = memberBySite.get(member.siteId) ?? [];
    list.push(member);
    memberBySite.set(member.siteId, list);
  }

  const sitesByOrg = new Map<number, typeof siteRows>();
  for (const site of siteRows) {
    const list = sitesByOrg.get(site.organisationId) ?? [];
    list.push(site);
    sitesByOrg.set(site.organisationId, list);
  }

  const currentSiteIds = new Set(userRows.map((user) => user.currentSiteId).filter((id): id is number => id !== null));
  const activeSiteIds = new Set(siteRows.filter((site) => site.isActive).map((site) => site.id));

  const allDataSiteIds = new Set<number | null>();
  for (const rows of [customerCounts, orderCounts, serviceCounts, expenseCounts]) {
    for (const row of rows) allDataSiteIds.add(row.siteId);
  }

  const siteData = Array.from(allDataSiteIds).map((siteId) => ({
    siteId,
    activeSite: siteId === null ? false : activeSiteIds.has(siteId),
    selectedByAnyUser: siteId === null ? false : currentSiteIds.has(siteId),
    members: siteId === null ? 0 : memberBySite.get(siteId)?.length ?? 0,
    customers: customerCounts.find((row) => row.siteId === siteId)?.count ?? 0,
    orders: orderCounts.find((row) => row.siteId === siteId)?.count ?? 0,
    services: serviceCounts.find((row) => row.siteId === siteId)?.count ?? 0,
    expenses: expenseCounts.find((row) => row.siteId === siteId)?.count ?? 0,
  }));

  const usersMissingOrg = userRows.filter((user) => !user.organisationId).map((user) => user.id);
  const usersMissingCurrentSite = userRows.filter((user) => !user.currentSiteId).map((user) => user.id);
  const sitesMissingMembers = siteRows
    .filter((site) => site.isActive && (memberBySite.get(site.id)?.length ?? 0) === 0)
    .map((site) => site.id);
  const currentSitesWithoutMembership = userRows
    .filter((user) => user.currentSiteId && !memberRows.some((member) => member.siteId === user.currentSiteId && member.userId === user.id))
    .map((user) => ({ userId: user.id, currentSiteId: user.currentSiteId }));

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: {
      users: userRows.length,
      organisations: orgRows.length,
      sites: siteRows.length,
      siteMembers: memberRows.length,
      payments: paymentCount[0]?.count ?? 0,
    },
    siteData,
    usersByOrganisation: orgRows.map((org) => ({
      organisationId: org.id,
      ownerId: org.ownerId,
      siteIds: (sitesByOrg.get(org.id) ?? []).map((site) => site.id),
    })),
    warnings: {
      nullSiteData: siteData.find((row) => row.siteId === null) ?? null,
      usersMissingOrg,
      usersMissingCurrentSite,
      sitesMissingMembers,
      currentSitesWithoutMembership,
      orphanDataSiteIds: siteData
        .filter((row) => row.siteId !== null && !row.activeSite)
        .map((row) => row.siteId),
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("../server/db");
    await pool.end();
  });
