---
name: Attendance uniqueness
description: Why attendance duplicate prevention must not rely on a global unique index during publishing.
---

**Rule:** Do not add a global unique index on employee/date attendance through the development-to-production schema diff while legacy production duplicates remain. Keep duplicate prevention in the application flow unless a supported production-data cleanup is completed first.

**Why:** Publish validation found historical production rows sharing the same employee and work date. The schema-only Publish flow cannot consolidate those rows, so a global unique index blocks unrelated additive columns needed by the live attendance feature. Replacing production with development data is not an acceptable workaround.

**How to apply:** Before proposing any future attendance uniqueness constraint, query production read-only for duplicate employee/date groups and design an explicit, user-approved preservation rule. Never use the Publish option that copies all development data merely to resolve this conflict.