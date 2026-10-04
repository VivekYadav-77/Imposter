import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import SwaggerParser from "@apidevtools/swagger-parser";

import { openApiDocument } from "../src/api/openapi.js";

const contractPath = resolve("openapi/openapi.json");
const expected = `${JSON.stringify(openApiDocument, null, 2)}\n`;
const current = await readFile(contractPath, "utf8");
if (current !== expected) {
  throw new Error("OpenAPI contract drift detected. Run npm run contracts:generate.");
}
await SwaggerParser.validate(structuredClone(openApiDocument) as never);
process.stdout.write("OpenAPI contract is current and valid.\n");
