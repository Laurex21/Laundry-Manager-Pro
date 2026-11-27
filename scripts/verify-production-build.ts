import { readFile, readdir, stat } from "fs/promises";
import path from "path";

// @ts-expect-error Shared dependency-free runtime verifier.
import starterAnchor from "./replit-starter-release-anchor.cjs";
// @ts-expect-error Shared dependency-free runtime verifier.
import invitationAnchor from "./replit-team-invitation-anchor.cjs";
// @ts-expect-error Shared dependency-free runtime verifier.
import phoneLoginAnchor from "./replit-phone-login-anchor.cjs";

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
  "starter-settings-basic",
  "admin-capacity",
  "capacity-preview",
  "input-invite-identifier",
  "input-invite-notification-phone",
  "button-whatsapp-created-invite",
  "/join/:token",
  "/demo/invitation/:token",
  "button-auth-submit",
  "input-staff-login-credential",
  "/staff-login",
];

async function verifyProductionBuild() {
  const manifest = JSON.parse(
    await readFile("dist/public/build-manifest.json", "utf8"),
  ) as {
    commit?: string;
    superadminReleaseGuard?: { version: number; baseline: string; commit: string };
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

  if (manifest.superadminReleaseGuard?.version !== 1 ||
      manifest.superadminReleaseGuard.baseline !== "2783e45118028dce5dc895332920ce1a1ea4df8d" ||
      manifest.superadminReleaseGuard.commit !== manifest.commit) {
    throw new Error("Production build verification failed: superadmin release guard is missing.");
  }
  starterAnchor.verifyStarterManifest(manifest);
  invitationAnchor.verifyInvitationManifest(manifest);
  phoneLoginAnchor.verifyPhoneLoginManifest(manifest);
  const serverBundle = await readFile("dist/index.cjs", "utf8");
  for (const marker of ["/api/platform-admin/organisations/:organisationId/capacity", "/api/platform-admin/organisations/:organisationId/capacity-preview", "platform_admin.capacity_grant"]) {
    if (!serverBundle.includes(marker)) throw new Error(`Production build verification failed: superadmin endpoint/audit marker ${marker} is missing.`);
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
    `Verified fresh production build for commit ${manifest.commit}: ${javascriptAssets.length} frontend bundles and ${requiredMarkers.length} required UI markers.`,
  );
}

verifyProductionBuild().catch((error) => {
  console.error(error);
  process.exit(1);
});
