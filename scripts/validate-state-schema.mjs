import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Ajv from "ajv";

const schemaPath = path.resolve("docs/schemas/pawn16-state.schema.json");
const targetPaths = process.argv.slice(2);

if (!targetPaths.length) {
  console.error("Usage: node scripts/validate-state-schema.mjs <state-json-path> [more-paths...]");
  process.exit(1);
}

const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

let failed = false;
for (const targetPath of targetPaths) {
  const absolutePath = path.resolve(targetPath);
  const payload = JSON.parse(await fs.readFile(absolutePath, "utf8"));
  const ok = validate(payload);
  if (!ok) {
    failed = true;
    console.error(`Schema validation failed: ${targetPath}`);
    for (const error of validate.errors ?? []) {
      console.error(`- ${error.instancePath || "/"} ${error.message}`);
    }
  } else {
    console.log(`Schema valid: ${targetPath}`);
  }
}

if (failed) process.exit(1);
