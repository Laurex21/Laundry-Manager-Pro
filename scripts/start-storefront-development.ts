// Full authenticated application, only against Replit's local development database.
// Unlike dev-storefront.ts, this launcher never installs fixture auth or an in-memory DB.
export {};
const database = new URL(process.env.DATABASE_URL || "postgresql://missing/invalid");
if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT ||
    !process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev") ||
    database.hostname !== "helium" || database.pathname !== "/heliumdb") {
  throw new Error("This launcher requires Replit development with DATABASE_URL targeting helium/heliumdb. Production and external databases are refused.");
}
Object.assign(process.env, {
  NODE_ENV: "development",
  XPRESSPRO_STOREFRONT_ENABLED: "true",
  XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED: "true",
  SAAS_BILLING_MODE: "disabled",
  SAAS_LIVE_ENABLED: "false",
  SALES_EMAIL_ENABLED: "false",
});
await import("../server/index");
