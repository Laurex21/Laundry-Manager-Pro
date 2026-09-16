import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expect(source: string, needle: string, message: string) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

const services = read("client/src/pages/services.tsx");
const machines = read("client/src/pages/machines.tsx");
const employees = read("client/src/pages/employees.tsx");

expect(services, 'data-testid="services-page-redesign"', "Services redesign marker missing");
expect(services, 'bg-[#082D5B]', "Services category headers must use the navy brand structure");
expect(services, "button-edit-service", "Service edit actions must remain available");
expect(services, "button-delete-service", "Service delete actions must remain available");

expect(machines, 'data-testid="machines-page-redesign"', "Machines redesign marker missing");
expect(machines, 'bg-[#082D5B]', "Machines table header must use the navy brand structure");
expect(machines, "ProductionCycleBoard", "Production cycles must remain available");
expect(machines, "button-machine-usage", "Machine usage actions must remain available");

expect(employees, 'data-testid="employees-page-redesign"', "Employees redesign marker missing");
expect(employees, 'bg-[#082D5B]', "Employees table header must use the navy brand structure");
expect(employees, "button-attendance-employee", "Employee attendance actions must remain available");
expect(employees, "button-edit-employee", "Employee edit actions must remain available");
expect(employees, "button-delete-employee", "Employee delete actions must remain available");

console.log("Production and staff redesign regression checks passed.");
