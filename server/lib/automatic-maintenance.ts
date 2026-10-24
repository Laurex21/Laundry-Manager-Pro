// Temporary release verification switch. Does not disable user-initiated operations.
// Restore normal maintenance by removing the variable or setting it to false.
export function automaticMaintenanceSuspended(): boolean {
  return process.env.XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED === "true";
}
