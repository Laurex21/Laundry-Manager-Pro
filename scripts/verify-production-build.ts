import { readFile, readdir, stat } from "fs/promises";
import path from "path";

const requiredFiles = [
  "dist/public/index.html",
  "dist/index.cjs",
  "dist/public/build-manifest.json",
];

const requiredMarkers = [
  "orders-page-redesign",
  "payments-page-redesign",
  "analytics-page-redesign",
  "settings-page-redesign",
];

async function verifyProductionBuild() {
  const manifest = JSON.parse(
    await readFile("dist/public/build-manifest.json", "utf8"),
  ) as {
    commit?: string;
    receiptReleaseGuard?: { version: number; baseline: string; commit: string };
    buildStartedAt?: string;
    buildCompletedAt?: string;
  };

  if (!manifest.commit || !/^[0-9a-f]{40}$/i.test(manifest.commit)) {
    throw new Error("Production build verification failed: missing valid Git commit.");
  }

  if (manifest.receiptReleaseGuard?.version !== 1 ||
      manifest.receiptReleaseGuard.baseline !== "b55a0a03481156af5cc29a0ce19647477e8e9645" ||
      manifest.receiptReleaseGuard.commit !== manifest.commit) {
    throw new Error("Production build verification failed: receipt release guard is missing.");
  }

  const buildStartedAt = Date.parse(manifest.buildStartedAt || "");
  if (!Number.isFinite(buildStartedAt)) {
    throw new Error("Production build verification failed: invalid build start time.");
  }

  for (const file of requiredFiles) {
    const fileStat = await stat(file);
    if (!fileStat.isFile() || fileStat.size === 0) {
      throw new Error(`Production build verification failed: ${file} is empty.`);
    }
    if (file !== "dist/public/build-manifest.json" && fileStat.mtimeMs < buildStartedAt - 1000) {
      throw new Error(
        `Production build verification failed: ${file} was not freshly generated.`,
      );
    }
  }

  const assetsDirectory = "dist/public/assets";
  const javascriptAssets = (await readdir(assetsDirectory))
    .filter((file) => file.endsWith(".js"))
    .map((file) => path.join(assetsDirectory, file));

  if (javascriptAssets.length === 0) {
    throw new Error("Production build verification failed: no frontend bundle found.");
  }

  const bundleContents = await Promise.all(
    javascriptAssets.map((file) => readFile(file, "utf8")),
  );

  for (const marker of requiredMarkers) {
    if (!bundleContents.some((content) => content.includes(marker))) {
      throw new Error(
        `Production build verification failed: marker ${marker} is absent from the frontend bundle.`,
      );
    }
  }

  console.log(
    `Verified fresh production build for commit ${manifest.commit}: ${javascriptAssets.length} frontend bundles and ${requiredMarkers.length} redesign markers.`,
  );
}

verifyProductionBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});