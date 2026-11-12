import type { PoolConfig } from "pg";

/** Do not let pg connection-string options override certificate verification. */
export function secureDatabaseConfig(env: NodeJS.ProcessEnv): PoolConfig {
  let url: URL;
  try { url = new URL(env.DATABASE_URL || ""); }
  catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("DATABASE_URL must be a PostgreSQL TCP URL");
  }
  // Query host overrides could disguise a remote host as localhost.
  if (url.searchParams.has("host") || url.searchParams.has("hostaddr")) {
    throw new Error("Set the database host in the URL authority, not query parameters");
  }
  // Only Replit's internal development database may use its non-TLS proxy.
  // Deployments, other hosts/databases and explicit TLS never use this exception.
  const deployment = !!env.REPLIT_DEPLOYMENT;
  const replitHeliumDevelopment = env.NODE_ENV === "development" && !deployment &&
    !!env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev") && url.hostname === "helium" &&
    url.pathname === "/heliumdb" && (!url.port || url.port === "5432");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || replitHeliumDevelopment;
  const sslMode = url.searchParams.get("sslmode");
  const sslFlag = url.searchParams.get("ssl");
  const tlsRequested = env.DATABASE_SSL === "true" ||
    (!!sslMode && sslMode !== "disable") || (!!sslFlag && !["false", "0"].includes(sslFlag));
  const tls = env.NODE_ENV === "production" || deployment || !local || tlsRequested;
  if (tls && (env.DATABASE_SSL === "false" || sslMode === "disable" || ["false", "0"].includes(sslFlag || ""))) {
    throw new Error("TLS cannot be disabled for a remote or production database");
  }
  // Avoid silently discarding existing client-certificate authentication.
  if (["sslcert", "sslkey", "sslrootcert"].some(key => url.searchParams.has(key))) {
    throw new Error("URL certificate file options are unsupported; configure DATABASE_SSL_CA for the trusted CA");
  }
  for (const key of ["ssl", "sslmode", "uselibpqcompat"]) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: tls ? { rejectUnauthorized: true, ...(env.DATABASE_SSL_CA ? { ca: env.DATABASE_SSL_CA.replace(/\\n/g, "\n") } : {}) } : false,
  };
}
