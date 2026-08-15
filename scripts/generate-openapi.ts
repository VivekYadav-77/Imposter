import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { openApiDocument } from "../src/api/openapi.js";

const outputPath = resolve("openapi/openapi.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(openApiDocument, null, 2)}\n`, "utf8");
process.stdout.write(`Generated ${outputPath}\n`);
