import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { analyze, applyFix } from "../src/index.js";
const read = (f: string) => readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8");

describe("analyze", () => {
  it("scores a good file highly", () => {
    const r = analyze(read("good.md"));
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.findings).toHaveLength(0);
  });
  it("flags a bad file", () => {
    const r = analyze(read("bad.md"));
    const rules = r.findings.map((f) => f.rule);
    for (const k of ["overview", "commands", "style", "structure", "vague", "contradiction", "secrets"]) expect(rules).toContain(k);
    expect(r.score).toBeLessThan(30);
  });
  it("detects missing individual commands", () => {
    const r = analyze("# X\n\n## Overview\nA tool that does a thing for people who need it badly.\n\nRun `npm test`.");
    expect(r.findings.find((f) => f.rule === "commands")?.title).toMatch(/build, lint/);
  });
  it("flags bloat", () => {
    expect(analyze("# X\n" + "line\n".repeat(450)).findings.some((f) => f.rule === "bloat" && f.severity === "error")).toBe(true);
  });
  it("handles empty", () => { expect(analyze("").score).toBe(0); });
  it("detects GitHub tokens and private keys", () => {
    expect(analyze("ghp_" + "a".repeat(36)).findings.some((f) => f.rule === "secrets")).toBe(true);
    expect(analyze("-----BEGIN RSA PRIVATE KEY-----").findings.some((f) => f.rule === "secrets")).toBe(true);
  });
});

describe("applyFix", () => {
  it("adds missing sections and improves the score", () => {
    const src = "# Thing\n";
    const before = analyze(src);
    const { text, added } = applyFix(src, before);
    expect(added).toEqual(expect.arrayContaining(["overview", "commands", "style", "structure"]));
    expect(analyze(text).score).toBeGreaterThan(before.score);
  });
  it("is a no-op on a good file", () => {
    const g = read("good.md");
    expect(applyFix(g, analyze(g)).added).toHaveLength(0);
  });
});
