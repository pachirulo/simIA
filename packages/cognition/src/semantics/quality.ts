export interface SemanticIssue { code: string; path: string; message: string }
export type OutputCheck<T> = (value: T) => SemanticIssue | null;

export const normalize = (text: string): string => text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();

/** High-confidence degeneration only. Normal emphasis and long, multiword names
 * are allowed. Do not guess whether arbitrary literary prose is true or complete. */
export function outputQualityIssue(value: unknown, path = ""): SemanticIssue | null {
  if (typeof value === "string") {
    const words = normalize(value).match(/[\p{L}\p{N}_]+/gu) ?? [];
    // At least 12 tokens repeating a unit of up to 4 words, e.g. "que" or "I will".
    for (let width = 1; width <= 4; width++) {
      let run = width;
      for (let i = width; i < words.length; i++) {
        run = words[i] === words[i - width] ? run + 1 : width;
        if (run >= Math.max(12, width * 4)) return { code: "repetition", path, message: "Repeated token loop. Write meaningful, concise text; omit optional empty content." };
      }
    }
    if (/(.)\1{15,}/u.test(value)) return { code: "repetition", path, message: "Repeated character loop; replace with meaningful text." };
  } else if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) { const issue = outputQualityIssue(item, `${path}[${index}]`); if (issue) return issue; }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) { const issue = outputQualityIssue(item, path ? `${path}.${key}` : key); if (issue) return issue; }
  }
  return null;
}

/** Invalid output is never replayed: especially not repetition loops or fake memories. */
export function semanticRepairNote(issue: SemanticIssue): string {
  return `Semantic error at ${issue.path}: ${issue.message} Reconsider the answer using current evidence; return corrected JSON. The previous proposal was NOT executed. Preserve deliberate personal choices, not misunderstandings of actions.`;
}
