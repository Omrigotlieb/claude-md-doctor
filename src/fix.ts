import type { Report, SectionKey } from "./rules.js";
export const TEMPLATES_URL = "https://github.com/Omrigotlieb/ai-skills/tree/main/templates";
// Section skeletons modeled on the ai-skills CLAUDE.md templates.
export const SECTIONS: Record<SectionKey, string> = {
  overview: `## Project overview\n\n<!-- TODO: 2–4 lines: what this project does, who uses it, main stack. -->\n`,
  commands: `## Commands\n\n\`\`\`bash\n# TODO: replace with your real commands\nnpm install      # install deps\nnpm run build    # build\nnpm test         # run tests\nnpm run lint     # lint\n\`\`\`\n`,
  style: `## Code style\n\n<!-- TODO: concrete, checkable rules -->\n- TypeScript strict mode; no \`any\`.\n- Named exports; one component per file.\n- Handle errors explicitly; never swallow exceptions.\n`,
  structure: `## Project structure\n\n<!-- TODO: key directories -->\n- \`src/\`: application code\n- \`test/\`: tests\n- \`docs/\`: longer documentation\n`,
};
export function applyFix(text: string, report: Report): { text: string; added: SectionKey[] } {
  const added = [...new Set(report.findings.map((f) => f.section).filter((s): s is SectionKey => !!s))];
  if (!added.length) return { text, added };
  let out = text.trim() ? text.replace(/\s*$/, "\n\n") : "# CLAUDE.md\n\n";
  out += `<!-- Added by claude-md-doctor. Full stack templates: ${TEMPLATES_URL} -->\n\n`;
  out += added.map((k) => SECTIONS[k]).join("\n");
  return { text: out, added };
}
