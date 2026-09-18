/** Label identifier-resolution failures without converting them into discoveries
 * about the world's accessibility, prices or people. Keep the original evidence. */
export function referenceEvidence(text: string): string {
  return /(?:action\.rejected|tried to)/u.test(text) && /\bno such (?:place|person|agent)\b/iu.test(text)
    ? `${text} [unresolved reference; no evidence of physical inaccessibility or refusal]`
    : text;
}
