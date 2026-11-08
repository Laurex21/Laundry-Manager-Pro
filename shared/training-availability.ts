/** Explicit false also disables training in development. Production is opt-in. */
export function trainingEnabled(environment: string | undefined, flag: string | undefined): boolean {
  if (flag !== undefined) return flag === 'true';
  return environment === 'development';
}
