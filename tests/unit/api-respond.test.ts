import { describe, expect, it } from "vitest";
import { isForbiddenOrigin, readJsonBody } from "@/lib/api/respond";

describe("API request safety", () => {
  it("accepts only loopback origins on the configured app port", () => {
    expect(
      isForbiddenOrigin(new Request("http://127.0.0.1:3000/api/test", {
        headers: { origin: "http://127.0.0.1:3000" },
      })),
    ).toBe(false);
    expect(
      isForbiddenOrigin(new Request("http://127.0.0.1:3000/api/test", {
        headers: { origin: "http://localhost:4000" },
      })),
    ).toBe(true);
    expect(
      isForbiddenOrigin(new Request("http://127.0.0.1:3000/api/test", {
        headers: { origin: "https://localhost:3000" },
      })),
    ).toBe(true);
  });

  it("rejects oversized JSON before parsing", async () => {
    const result = await readJsonBody(
      new Request("http://127.0.0.1:3000/api/test", {
        method: "POST",
        headers: { "content-length": "1000001" },
        body: "{}",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("parses valid JSON and rejects malformed JSON", async () => {
    const valid = await readJsonBody(
      new Request("http://127.0.0.1:3000/api/test", { method: "POST", body: '{"ok":true}' }),
    );
    expect(valid.ok).toBe(true);

    const invalid = await readJsonBody(
      new Request("http://127.0.0.1:3000/api/test", { method: "POST", body: "{" }),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.response.status).toBe(400);
  });
});
