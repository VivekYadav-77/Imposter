import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import { readJsonBody } from "../../src/api/body.js";

describe("readJsonBody", () => {
  it("parses bounded JSON", async () => {
    const request = Readable.from([Buffer.from('{"ok":true}')]);
    await expect(readJsonBody(request as never, 1024)).resolves.toEqual({ ok: true });
  });

  it("rejects chunked payloads over the limit", async () => {
    const request = Readable.from([Buffer.from("12345"), Buffer.from("67890")]);
    await expect(readJsonBody(request as never, 5)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  });
});
