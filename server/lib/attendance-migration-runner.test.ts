import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-reviewed-migrations.ts", "utf8");
const migration = readFileSync("migrations/20260919_attendance_reliability.sql", "utf8");

assert.match(
  runner,
  /20260919_attendance_reliability\.sql/,
  "the reviewed migration runner must apply the attendance reliability migration",
);
assert.match(migration, /ADD COLUMN IF NOT EXISTS corrected_by/);
assert.match(migration, /employee_attendance_employee_work_date_unique/);

console.log("Attendance migration runner regression test passed.");
