import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "client/src/pages/expenses.tsx"), "utf8");
const categories = fs.readFileSync(path.join(root, "client/src/lib/expense-categories.ts"), "utf8");
const routes = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");

const categoryValues = [...categories.matchAll(/\{ value: "([^"]+)", labelKey:/g)].map((match) => match[1]);
assert.equal(categoryValues.length, 10, "expense filters must expose exactly 10 controlled categories");
assert.equal(new Set(categoryValues).size, 10, "controlled expense categories must be unique");
assert.match(page, /EXPENSE_CATEGORIES\.map/, "category chips and select must use the controlled vocabulary");
assert.doesNotMatch(page, /expenditures\?\.forEach\(\(expense\).*categories/s, "free-text expense values must not become category filters");
assert.match(page, /window\.setTimeout\(\(\) => setDebouncedSearch.*300\)/s, "search must use a 300ms debounce");
assert.match(page, /PAGE_SIZE = 20/, "expense history must paginate at 20 rows");
assert.match(page, /button-delete-expense-/, "every expense row must expose a delete action");
assert.match(routes, /app\.delete\("\/api\/expenditures\/:id"[\s\S]*canAccessExpenditure[\s\S]*requireSiteRole/, "deletion must verify tenant access and role");

console.log("Expense redesign regression checks passed");
