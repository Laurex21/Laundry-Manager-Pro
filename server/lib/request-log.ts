/** Never retain URL parameter values in request logs, including unknown routes. */
export function safeRequestLogPath(route: unknown, path: string): string {
  if (typeof route === "string" && route.startsWith("/api")) return route;
  return path.startsWith("/api") ? "/api/[unmatched-or-blocked]" : "[non-api]";
}
