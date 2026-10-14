export type Severity = "error" | "warn" | "info";
export interface Finding {
    rule: string;
    title: string;
    severity: Severity;
    penalty: number;
    message: string;
    fix: string;
    section?: SectionKey;
}
export type SectionKey = "overview" | "commands" | "style" | "structure";
export interface Report {
    score: number;
    grade: string;
    lines: number;
    words: number;
    findings: Finding[];
    passed: string[];
}
export declare function analyze(text: string): Report;
