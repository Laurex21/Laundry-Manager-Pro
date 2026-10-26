/** Planning only. No account creation, permission grant or production executor. */
export type DualRoleEvidence = {
  ownerId: string;
  ownedOrganisationId: number;
  linkedOrganisationId: number;
  ownedCount: number;
  memberships: { siteId: number; organisationId: number; role: string }[];
};

export function previewDualRoleSeparation(evidence: DualRoleEvidence) {
  const owned = evidence.memberships.filter(m => m.organisationId === evidence.ownedOrganisationId);
  const foreign = evidence.memberships.filter(m => m.organisationId !== evidence.ownedOrganisationId);
  const reasons: string[] = [];
  if (![evidence.ownedOrganisationId, evidence.linkedOrganisationId, ...evidence.memberships.flatMap(m => [m.siteId, m.organisationId])].every(id => Number.isSafeInteger(id) && id > 0)
    || evidence.ownedOrganisationId === evidence.linkedOrganisationId) reasons.push("INVALID_ORGANISATION_CONTEXT");
  if (!evidence.ownerId || evidence.ownedCount !== 1 || !owned.some(m => m.role === "owner")) reasons.push("OWNERSHIP_REVIEW_REQUIRED");
  if (!foreign.length || foreign.some(m => m.organisationId !== evidence.linkedOrganisationId || !["operator", "manager"].includes(m.role))) reasons.push("FOREIGN_ACCESS_REVIEW_REQUIRED");
  if (new Set(evidence.memberships.map(m => m.siteId)).size !== evidence.memberships.length) reasons.push("DUPLICATE_MEMBERSHIP_REVIEW_REQUIRED");
  return {
    status: reasons.length ? "review_required" : "ready_for_isolated_separation",
    reasons,
    owner: { userId: evidence.ownerId, organisationId: evidence.ownedOrganisationId, memberships: owned },
    staff: { organisationId: evidence.linkedOrganisationId, memberships: foreign },
    // Existing auth intentionally binds each login to one organisation. A new
    // staff identity uses the ordinary invitation flow, never a copied password.
    requiresDistinctStaffLogin: true,
    requiresBothOwnersApproval: true,
    historyMustRemainUnchanged: true,
  } as const;
}
