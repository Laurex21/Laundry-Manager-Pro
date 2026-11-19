import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { execFileSync } from "child_process";
import { rm, readFile, writeFile } from "fs/promises";
// @ts-expect-error Dependency-free guard is also used by Node before installation.
import { verifyReceiptRelease } from "../scripts/verify-receipt-release.mjs";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const receiptReleaseGuard = verifyReceiptRelease();
  execFileSync(process.execPath, ["--import", "tsx", "server/lib/receipt-export.test.ts"], { stdio: "inherit" });
  execFileSync(process.execPath, ["--import", "tsx", "--test", "client/src/lib/receipt-request.test.ts"], { stdio: "inherit" });
  const buildStartedAt = new Date().toISOString();
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  const commit = receiptReleaseGuard.commit;

  await writeFile(
    "dist/public/build-manifest.json",
    JSON.stringify(
      {
        commit,
        receiptReleaseGuard,
        buildStartedAt,
        buildCompletedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
