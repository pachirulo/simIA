export function cleanSchema(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(cleanSchema);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (k === "pattern" || k === "$schema" || k === "default") continue;
      o[k === "oneOf" ? "anyOf" : k] = cleanSchema(v);
    }
    return o;
  }
  return x;
}
/**
 * OpenAI's strict mode wants every property listed as required, every object closed, and no bounds: an optional field becomes
 * nullable and required, and the nulls are stripped again before the answer meets the zod schema (see stripNulls).
 */
export function strictSchema(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(strictSchema);
  if (x && typeof x === "object") {
    const src = x as Record<string, unknown>; const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) { if (["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "exclusiveMinimum", "exclusiveMaximum", "format"].includes(k)) continue; o[k] = strictSchema(v); }
    if (o.type === "object" && o.properties && typeof o.properties === "object") {
      const props = o.properties as Record<string, unknown>; const required = new Set((o.required as string[] | undefined) ?? []);
      for (const name of Object.keys(props)) if (!required.has(name)) props[name] = { anyOf: [props[name], { type: "null" }] };
      o.required = Object.keys(props); o.additionalProperties = false;
    }
    return o;
  }
  return x;
}
export function stripNulls(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(stripNulls);
  if (x && typeof x === "object") { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(x as Record<string, unknown>)) if (v !== null) o[k] = stripNulls(v); return o; }
  return x;
}
export const wantsStrict = (model: string) => model.startsWith("openai/") || model.startsWith("~openai/");
