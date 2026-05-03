import fs from "node:fs";

const optionsPath = "foundry-data/Config/options.json";
const world = process.env.FOUNDRY_TEST_WORLD ?? "pawn16-test";

const options = JSON.parse(fs.readFileSync(optionsPath, "utf8"));
options.world = world;
fs.writeFileSync(optionsPath, `${JSON.stringify(options, null, 2)}\n`);

console.log(`Configured local options.json default world: ${world}`);
console.log("Docker startup also uses FOUNDRY_WORLD from compose.yml.");
