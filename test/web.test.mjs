import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("browser playground", () => {
  it("bumps the generated engine version with package.json", async () => {
    const pkg = JSON.parse(read("package.json"));
    const { VERSION } = await import("../web/engine/version.js");
    expect(VERSION).toBe(pkg.version);
  });

  it("generates samples from the bundled example files", async () => {
    const { SAMPLES } = await import("../web/engine/samples.js");
    expect(SAMPLES.vague).toBe(read("examples/support-reply.v1.md"));
    expect(SAMPLES.structured).toBe(read("examples/support-reply.v2.md"));
  });

  it("ships an engine that lints and compares the examples", async () => {
    const { SAMPLES } = await import("../web/engine/samples.js");
    const { diffPrompts, lintPrompt } = await import("../web/engine/web.js");
    const vague = lintPrompt(SAMPLES.vague, { version: "test" });
    const structured = lintPrompt(SAMPLES.structured, { version: "test" });
    expect(vague.score.total).toBe(68);
    expect(vague.findings).toHaveLength(6);
    expect(structured.score.total).toBe(100);
    expect(structured.findings).toHaveLength(0);
    const diff = diffPrompts(SAMPLES.vague, SAMPLES.structured, { version: "test" });
    expect(diff.delta.score).toBe(32);
    expect(diff.delta.tokens).toBe(335);
  });

  it("loads its stylesheet and module entry from the static page", () => {
    const html = read("index.html");
    expect(html).toContain('href="./web/style.css"');
    expect(html).toContain('src="./web/app.js"');
    expect(html).toContain('id="promptEditor"');
  });
});
