#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { analyze } from "./rules.js";
import { applyFix, TEMPLATES_URL } from "./fix.js";
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
if (flag("-h") || flag("--help")) {
    console.log(`claude-md-doctor [file] [--fix] [--json] [--min <score>]\n\n  file     path to CLAUDE.md (default: ./CLAUDE.md)\n  --fix    append missing sections (overview, commands, style, structure)\n  --json   machine-readable output\n  --min N  exit 1 if score < N (for CI)`);
    process.exit(0);
}
const minIdx = args.indexOf("--min");
const min = minIdx >= 0 ? Number(args[minIdx + 1]) : undefined;
const file = args.find((a, i) => !a.startsWith("-") && (minIdx < 0 || i !== minIdx + 1)) ?? "CLAUDE.md";
const color = process.stdout.isTTY && !process.env.NO_COLOR && !flag("--json");
const c = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = c(31), green = c(32), yellow = c(33), cyan = c(36), dim = c(2), bold = c(1);
let text = "";
if (existsSync(file))
    text = readFileSync(file, "utf8");
else if (!flag("--fix")) {
    console.error(`${file} not found. Run with --fix to create one.`);
    process.exit(2);
}
let report = analyze(text);
let added = [];
if (flag("--fix")) {
    const r = applyFix(text, report);
    if (r.added.length) {
        writeFileSync(file, r.text);
        added = r.added;
        report = analyze(r.text);
    }
}
if (flag("--json"))
    console.log(JSON.stringify({ file, ...report, fixed: added }, null, 2));
else
    print(report);
if (min !== undefined && report.score < min)
    process.exit(1);
function print(r) {
    const sc = r.score >= 80 ? green : r.score >= 60 ? yellow : red;
    console.log(`\n${bold("claude-md-doctor")} ${dim(file)}\n`);
    console.log(`  Score: ${bold(sc(`${r.score}/100`))}  Grade ${bold(sc(r.grade))}  ${dim(`(${r.lines} lines, ${r.words} words)`)}\n`);
    for (const p of r.passed)
        console.log(`  ${green("✓")} ${p}`);
    for (const f of r.findings) {
        const icon = f.severity === "error" ? red("✗") : f.severity === "warn" ? yellow("!") : cyan("i");
        console.log(`  ${icon} ${bold(f.title)} ${dim(`-${f.penalty}`)}\n      ${f.message}\n      ${cyan("fix:")} ${f.fix}`);
    }
    if (added.length)
        console.log(`\n  ${green("Added sections:")} ${added.join(", ")}. Fill in the TODOs.`);
    else if (r.findings.some((f) => f.section))
        console.log(`\n  ${dim("Tip: run with --fix to scaffold missing sections.")}`);
    console.log(`  ${dim(`Stack templates: ${TEMPLATES_URL}`)}\n`);
}
