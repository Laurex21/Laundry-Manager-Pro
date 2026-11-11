import assert from 'node:assert/strict';
import { registerCashbookRoutes } from './cashbook-routes';
import { respondCashbookDatabaseError } from './cashbook-errors';
const inaccessible = new Proxy({}, { get() { throw new Error('Disabled cashbook touched app or database'); } });
for (const [environment, enabled] of [['production', 'true'], ['production', 'false'], ['development', 'false'], ['test', 'true']]) {
  process.env.NODE_ENV = environment;
  process.env.XPRESSPRO_CASHBOOK_DEVELOPMENT = enabled;
  registerCashbookRoutes(inaccessible as any, inaccessible as any);
  assert.equal(respondCashbookDatabaseError(inaccessible, new Error('CASHBOOK_PERIOD_CLOSED')), false);
}
console.log('PASS: production and disabled cashbook register no routes and perform no database access.');
