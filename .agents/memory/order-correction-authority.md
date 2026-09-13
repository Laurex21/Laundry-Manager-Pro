---
name: Order correction authority
description: Role-specific justification policy for controlled order corrections.
---

**Rule:** An organisation owner may correct an order without entering a correction reason. A manager must provide a meaningful reason before the correction is accepted.

**Why:** The owner is the final authority for the organisation, while delegated managers need an explicit justification for accountability. The system must still record owner corrections automatically so the audit trail remains complete.

**How to apply:** Apply the distinction on both the server and interface for direct edits and corrected replacement orders. Never rely on hiding the field alone; enforce manager justification server-side and store a neutral automatic audit reason for owner actions.