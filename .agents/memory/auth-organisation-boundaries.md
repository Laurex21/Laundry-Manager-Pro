---
name: Cross-organisation authentication boundaries
description: Ownership and site memberships must resolve within the same organisation.
---

**Rule:** The organisation owner is authoritative for administrator access; site memberships must be filtered through the user's organisation and must never elevate a user across organisation boundaries.

**Why:** Legacy account associations can point a user at one organisation while their owned site belongs to another, creating incorrect roles and potential cross-tenant access.

**How to apply:** Repair only the user association when the user owns the target organisation and has an owner membership there. Treat historical cross-site references as inert audit findings until an owner approves a record-by-record repair; never move or rewrite customers, orders, or other business records automatically.