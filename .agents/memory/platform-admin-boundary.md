---
name: Platform administrator boundary
description: Security boundary and bootstrap rule for platform-wide administration.
---

**Rule:** Platform-administrator access must remain separate from organisation owner, manager, and operator roles. Grant it only through the dedicated platform-admin registry, with initial identities supplied by owner-controlled environment configuration.

**Why:** Organisation ownership is tenant-scoped. Treating an owner as a platform administrator would silently bypass cross-organisation isolation and could repeat historical account-boundary failures.

**How to apply:** Protect every platform-wide API on the server with the dedicated platform-admin check. Frontend visibility is not authorization. Never infer platform access from organisation ownership or hardcode an administrator email in application code.