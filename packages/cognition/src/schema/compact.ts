type Node = Record<string, unknown>;
const object = (value: unknown): value is Node => value !== null && typeof value === "object" && !Array.isArray(value);

/** Lossless wire-schema compression. Never changes the canonical Zod validator.
 * Merge object alternatives only when EVERYTHING except the required kind literal
 * is identical. Retain all actions, fields, bounds, required lists and closure.
 * No $refs, relaxed union of fields, or perception-based action filtering.
 */
export function compactActionSchema(value: unknown, keepTypes = false): unknown {
  if (Array.isArray(value)) return value.map(item => compactActionSchema(item, keepTypes));
  if (!object(value)) return value;
  const result: Node = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compactActionSchema(item, keepTypes)]));
  if (Array.isArray(result.anyOf)) {
    const groups = new Map<string, Node>();
    const alternatives: unknown[] = [];
    for (const branch of result.anyOf) {
      const properties = object(branch) && object(branch.properties) ? branch.properties : undefined;
      const kind = properties && object(properties.kind) ? properties.kind : undefined;
      if (!object(branch) || branch.type !== "object" || !properties || !kind || typeof kind.const !== "string"
          || !Array.isArray(branch.required) || !branch.required.includes("kind")) {
        alternatives.push(branch);
        continue;
      }
      const { const: literal, ...kindRules } = kind;
      const key = JSON.stringify({ ...branch, properties: { ...properties, kind: kindRules } });
      const previous = groups.get(key);
      if (!previous) {
        groups.set(key, kind);
        alternatives.push(branch);
      } else {
        if (!Array.isArray(previous.enum)) {
          previous.enum = [previous.const];
          delete previous.const;
        }
        (previous.enum as unknown[]).push(literal);
      }
    }
    result.anyOf = alternatives;
  }
  // A string literal/enum already implies type:string in JSON Schema. OpenAI's
  // restricted strict dialect keeps explicit types, as did the original adapter.
  if (!keepTypes && result.type === "string" && (typeof result.const === "string"
      || (Array.isArray(result.enum) && result.enum.length > 0 && result.enum.every(item => typeof item === "string")))) {
    delete result.type;
  }
  return result;
}
