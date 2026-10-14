export type Severity = "error" | "warn" | "info";
export interface Finding { rule: string; title: string; severity: Severity; penalty: number; message: string; fix: string; section?: SectionKey; }
export type SectionKey = "overview" | "commands" | "style" | "structure";
export interface Report { score: number; grade: string; lines: number; words: number; findings: Finding[]; passed: string[]; }

const has = (t: string, re: RegExp) => re.test(t);
const heading = (t: string, re: RegExp) => t.split("\n").some((l) => /^#{1,6}\s/.test(l) && re.test(l));

const VAGUE = [
  /\bwrite (good|clean|nice|quality) code\b/i, /\bbest practices\b/i, /\bbe careful\b/i, /\bas needed\b/i,
  /\bwhen appropriate\b/i, /\bif necessary\b/i, /\bmake sure (it|everything) works\b/i, /\buse common sense\b/i,
  /\betc\.?$/im, /\bproperly\b/i,
];
const SECRETS: [string, RegExp][] = [
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["OpenAI/Anthropic key", /\bsk-(ant-)?[A-Za-z0-9_-]{20,}\b/],
  ["Slack token", /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["password assignment", /\b(password|passwd|secret|api[_-]?key)\s*[:=]\s*["']?[^\s"'<>{}]{8,}/i],
];
const CONTRA: [RegExp, RegExp, string][] = [
  [/\buse tabs\b/i, /\buse (2|two|4|four) spaces\b|\bspaces (for|not tabs)/i, "tabs vs spaces"],
  [/\buse npm\b/i, /\buse (pnpm|yarn|bun)\b/i, "package manager"],
  [/\buse pnpm\b/i, /\buse (npm|yarn|bun)\b/i, "package manager"],
  [/\b(use|always use|require) semicolons\b/i, /\b(no|never use|avoid) semicolons\b/i, "semicolons"],
  [/\bsingle quotes\b/i, /\bdouble quotes\b/i, "quote style"],
  [/\balways write tests\b/i, /\b(don'?t|do not|never) write tests\b/i, "testing"],
  [/\b(use|prefer) default exports?\b/i, /\b(no|avoid|never use) default exports?\b/i, "exports"],
];

export function analyze(text: string): Report {
  const findings: Finding[] = []; const passed: string[] = [];
  const lines = text.split("\n").length; const words = (text.match(/\S+/g) || []).length;
  const add = (f: Finding) => findings.push(f);
  const ok = (s: string) => passed.push(s);

  if (!text.trim()) {
    add({ rule: "empty", title: "Empty file", severity: "error", penalty: 100, message: "CLAUDE.md is empty.", fix: "Run with --fix to scaffold one." });
    return finish(findings, passed, lines, words);
  }
  // overview
  if (heading(text, /overview|about|what is|introduction|^#+\s*project\s*$/i) || /^#\s.+\n+[^#\n]*\b(is an?|is the|project|app|application|service|library|tool|monorepo)\b[^\n]{20,}/im.test(text)) ok("Project overview");
  else add({ rule: "overview", title: "No project overview", severity: "error", penalty: 15, section: "overview", message: "Claude can't tell what this project is or who it's for.", fix: "Add a 2–4 line '## Project overview': what it does, the stack, and the main entry points." });
  // commands
  const cmd = { build: /\b(npm|pnpm|yarn|bun) (run )?build\b|\bmake( build)?\b|\bcargo build\b|\bgo build\b|\btsc\b|\bgradle\w* build\b|\bmvn \w*package/i,
    test: /\b(npm|pnpm|yarn|bun) (run )?test\b|\bpytest\b|\bvitest\b|\bjest\b|\bcargo test\b|\bgo test\b|\bmake test\b|\bmvn test\b/i,
    lint: /\b(npm|pnpm|yarn|bun) (run )?lint\b|\beslint\b|\bruff\b|\bflake8\b|\bclippy\b|\bgolangci-lint\b|\bprettier\b|\bbiome\b|\bmypy\b/i };
  const missing = (Object.keys(cmd) as (keyof typeof cmd)[]).filter((k) => !has(text, cmd[k]));
  if (!missing.length) ok("Build / test / lint commands");
  else add({ rule: "commands", title: `Missing commands: ${missing.join(", ")}`, severity: missing.length >= 2 ? "error" : "warn", penalty: missing.length * 7, section: "commands", message: "Without exact commands Claude guesses how to verify its work.", fix: `Add a '## Commands' section with the exact ${missing.join("/")} command(s) in a code block.` });
  // style
  if (heading(text, /style|convention|guideline|standard/i)) ok("Code style section");
  else add({ rule: "style", title: "No code style / conventions", severity: "warn", penalty: 10, section: "style", message: "Claude will fall back to generic style.", fix: "Add '## Code style' with 3–6 concrete, checkable rules (naming, imports, error handling)." });
  // structure
  if (heading(text, /structure|layout|architecture|directories|folders/i) || /(^|\s)(src|app|lib|packages)\/[\w-]*/m.test(text)) ok("Project structure");
  else add({ rule: "structure", title: "No project structure", severity: "warn", penalty: 10, section: "structure", message: "Claude has to explore the tree to find where things live.", fix: "Add '## Project structure' listing key directories and what lives in each." });
  // bloat
  if (lines > 400 || words > 3500) add({ rule: "bloat", title: "Too long", severity: "error", penalty: 15, message: `${lines} lines / ${words} words. CLAUDE.md is loaded into every session; bloat costs tokens and dilutes instructions.`, fix: "Keep it under ~200 lines. Move details into docs/ and reference them." });
  else if (lines > 200 || words > 1800) add({ rule: "bloat", title: "Getting long", severity: "warn", penalty: 7, message: `${lines} lines / ${words} words.`, fix: "Trim to essentials; link out to longer docs." });
  else if (words < 40) add({ rule: "bloat", title: "Too thin", severity: "warn", penalty: 8, message: `Only ${words} words, so there's little guidance for Claude.`, fix: "Cover overview, commands, style and structure at minimum." });
  else ok("Healthy length");
  // vague
  const vague = [...new Set(VAGUE.flatMap((re) => { const m = text.match(re); return m ? [m[0].trim()] : []; }))];
  if (vague.length) add({ rule: "vague", title: `Vague phrases (${vague.length})`, severity: "warn", penalty: Math.min(12, vague.length * 3), message: `Found: ${vague.map((v) => `"${v}"`).join(", ")}`, fix: "Replace with checkable rules, e.g. 'functions under 40 lines', 'run npm test before committing'." });
  else ok("No vague phrases");
  // contradictions
  const contra = CONTRA.filter(([a, b]) => has(text, a) && has(text, b)).map(([, , n]) => n);
  if (contra.length) add({ rule: "contradiction", title: `Contradictions: ${[...new Set(contra)].join(", ")}`, severity: "error", penalty: Math.min(20, contra.length * 10), message: "Conflicting instructions make Claude's behavior unpredictable.", fix: "Pick one rule per topic and delete the other." });
  else ok("No contradictions");
  // secrets
  const sec = SECRETS.filter(([, re]) => re.test(text)).map(([n]) => n);
  if (sec.length) add({ rule: "secrets", title: "Possible secrets", severity: "error", penalty: 25, message: `Looks like: ${sec.join(", ")}. CLAUDE.md is usually committed.`, fix: "Remove it now, rotate the credential, and reference env vars instead." });
  else ok("No secrets");
  return finish(findings, passed, lines, words);
}

function finish(findings: Finding[], passed: string[], lines: number, words: number): Report {
  const score = Math.max(0, 100 - findings.reduce((s, f) => s + f.penalty, 0));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return { score, grade, lines, words, findings, passed };
}
