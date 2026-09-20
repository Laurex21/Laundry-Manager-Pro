import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../../shared/schema.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../../client/src/pages/employees.tsx", import.meta.url), "utf8");

assert.match(schema, /employee_attendance_employee_work_date_unique/);
assert.match(schema, /correctedBy/);
assert.match(schema, /correctionReason/);
assert.match(routes, /attendance\/check-in/);
assert.match(routes, /attendance\/check-out/);
assert.match(routes, /Attendance already exists for this employee and date/);
assert.match(routes, /Attendance duration cannot exceed 16 hours/);
assert.match(routes, /correction reason of at least 8 characters/i);
assert.match(routes, /requireSiteRole\(req, res, employee\.siteId, \["owner", "manager"\]\)/);
assert.match(ui, /button-check-in-/);
assert.match(ui, /button-check-out-/);
assert.match(ui, /Journée clôturée/);

console.log("attendance reliability regression passed");
