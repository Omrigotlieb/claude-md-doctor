import type { Report, SectionKey } from "./rules.js";
export declare const TEMPLATES_URL = "https://github.com/Omrigotlieb/ai-skills/tree/main/templates";
export declare const SECTIONS: Record<SectionKey, string>;
export declare function applyFix(text: string, report: Report): {
    text: string;
    added: SectionKey[];
};
