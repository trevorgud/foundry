import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import Ajv from "ajv";

const schemaPath = path.resolve("docs/schemas/pawn16-state.schema.json");
const fixtureDir = path.resolve("tests/fixtures/state");

test("all state fixtures conform to pawn16 state schema", async () => {
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  const entries = await fs.readdir(fixtureDir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => path.join(fixtureDir, entry.name))
    .sort();

  assert.ok(files.length > 0, "Expected at least one JSON fixture in tests/fixtures/state.");

  for (const file of files) {
    const payload = JSON.parse(await fs.readFile(file, "utf8"));
    const valid = validate(payload);
    assert.equal(valid, true, `Schema validation failed for ${path.basename(file)}: ${formatErrors(validate.errors)}`);
  }
});

function formatErrors(errors) {
  if (!errors?.length) return "unknown schema error";
  return errors.map(error => `${error.instancePath || "/"} ${error.message}`).join("; ");
}
