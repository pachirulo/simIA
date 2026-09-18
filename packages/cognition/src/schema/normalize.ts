import { z } from "zod";

/** Empty optional strings mean omission on the LLM wire. Required fields, nulls,
 * numbers and nonempty references retain their canonical validation semantics. */
export function normalizeOptionalStrings(value: unknown, schema: z.core.$ZodType): unknown {
  if (schema instanceof z.ZodOptional) {
    const inner = schema.unwrap();
    const string = inner instanceof z.ZodNullable ? inner.unwrap() : inner;
    if (typeof value === "string" && !value.trim() && string instanceof z.ZodString) return undefined;
    return normalizeOptionalStrings(value, schema.unwrap());
  }
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) return normalizeOptionalStrings(value, schema.unwrap());
  if (schema instanceof z.ZodArray && Array.isArray(value)) return value.map(item => normalizeOptionalStrings(item, schema.element));
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (schema instanceof z.ZodUnion) {
    const branch = schema.options.find(option => option instanceof z.ZodObject && option.shape.kind?.safeParse(record.kind).success);
    return branch ? normalizeOptionalStrings(value, branch) : value;
  }
  if (!(schema instanceof z.ZodObject)) return value;
  return Object.fromEntries(Object.entries(record).flatMap(([key, field]) => {
    const child = schema.shape[key] as z.ZodType | undefined;
    const normalized = child ? normalizeOptionalStrings(field, child) : field;
    return normalized === undefined ? [] : [[key, normalized]];
  }));
}
