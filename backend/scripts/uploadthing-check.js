// UploadThing diagnostic + live upload check.
//
// Usage:
//   npm run uploadthing:check
//   npm run uploadthing:check -- --file ./path/to/image.jpg
//
// The first form prints whether UploadThing is configured. The second form also
// uploads the given JPG/PNG/WEBP image and prints the returned URL. Secrets are
// never printed.

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const { getUploadThingConfig, uploadImage } = require("../src/services/uploadthingService");

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function printConfig(config) {
  console.log("UploadThing configuration (v7)");
  console.log("------------------------------");
  console.log(`  credential source : ${config.source}`);
  console.log(`  token present     : ${config.configured ? "yes" : "no"}`);
  console.log(`  token shape       : ${config.tokenValid ? "valid" : "invalid"}`);
  console.log(`  server SDK        : ${config.sdkAvailable ? "available" : "missing"}`);
  console.log(`  uploads enabled   : ${config.enabled ? "yes" : "no"}`);
  console.log(`  app id            : ${config.appId || "(not set)"}`);
  console.log(`  region            : ${config.region || "(not set)"}`);
  console.log(`  max image size    : ${Math.round(config.maxBytes / (1024 * 1024))} MB`);
  console.log(`  token issue       : ${config.tokenIssue || "none"}`);
  if (config.normalizations?.length) {
    console.log(`  safe normalization: ${config.normalizations.join("; ")}`);
  }
  console.log(`  diagnostic        : ${config.diagnostic}`);
}

async function main() {
  const config = getUploadThingConfig();
  printConfig(config);

  if (!config.enabled) {
    console.error(
      "\nUploads are not enabled. Set UPLOADTHING_TOKEN to the V7 token from the UploadThing " +
        "dashboard (API Keys -> V7) in the backend environment, then restart/redeploy and run " +
        "this command again. Legacy v6 secrets are not accepted."
    );
    process.exitCode = 1;
    return;
  }

  const fileFlag = process.argv.indexOf("--file");
  if (fileFlag === -1) {
    console.log("\nConfiguration check only. Pass --file <path> to perform a live upload.");
    return;
  }

  const filePath = path.resolve(process.argv[fileFlag + 1] || "");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    console.error(`\nFile not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimetype = MIME_BY_EXT[ext];
  if (!mimetype) {
    console.error("\nUnsupported file type. Use a JPG, JPEG, PNG, or WEBP image.");
    process.exitCode = 1;
    return;
  }

  const buffer = fs.readFileSync(filePath);
  console.log(`\nUploading ${path.basename(filePath)} (${buffer.length} bytes)...`);

  const result = await uploadImage({
    originalname: path.basename(filePath),
    mimetype,
    size: buffer.length,
    buffer,
  });

  if (!result.ok) {
    console.error(`Upload failed (HTTP ${result.status || 500}): ${result.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("Upload succeeded.");
  console.log(`  URL : ${result.url}`);
  console.log(`  key : ${result.key || "(not returned)"}`);

  // The UploadThing SDK keeps internal handles open, which would otherwise
  // leave this command hanging after a successful upload. Flush stdout, then
  // exit explicitly so the diagnostic terminates.
  process.stdout.write("", () => process.exit(0));
}

main().catch((err) => {
  console.error("Unexpected error:", (err && err.message) || err);
  process.exitCode = 1;
});
