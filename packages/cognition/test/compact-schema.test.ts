import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActionProposal } from "@unwatched/protocol";
import { cleanSchema, strictSchema } from "../src/schema/json.ts";
import { compactActionSchema } from "../src/schema/compact.ts";

type Node = Record<string, any>;

/** Independent inverse: expand kind enums, restore implied string types and sort
 * alternatives. Equality proves all branch constraints and annotations survived. */
function expanded(value: any): any {
  if (Array.isArray(value)) return value.map(expanded);
  if (!value || typeof value !== "object") return value;
  const node: Node = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expanded(item)]));
  if (typeof node.const === "string" || (Array.isArray(node.enum) && node.enum.length && node.enum.every((v: unknown) => typeof v === "string"))) node.type ??= "string";
  if (Array.isArray(node.anyOf)) {
    node.anyOf = node.anyOf.flatMap((branch: Node) => {
      if (!branch.properties?.kind?.enum || !branch.required?.includes("kind")) return [branch];
      const { enum: kinds, ...rules } = branch.properties.kind;
      return kinds.map((kind: string) => ({ ...branch, properties: { ...branch.properties, kind: { ...rules, const: kind } } }));
    }).sort((a: Node, b: Node) => String(a.properties?.kind?.const).localeCompare(String(b.properties?.kind?.const)));
  }
  return node;
}

describe("lossless action wire schema", () => {
  it.each([false, true])("preserves all canonical constraints, including nested steps (OpenAI=%s)", strict => {
    const original = cleanSchema(z.toJSONSchema(ActionProposal));
    const before = structuredClone(original);
    const compact = compactActionSchema(original, strict);
    expect(expanded(compact)).toEqual(expanded(original));
    if (strict) expect(expanded(strictSchema(compact))).toEqual(expanded(strictSchema(original)));
    expect(original).toEqual(before);
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(original).length * .90);
    for (const kind of ["offer", "accept", "refuse", "settle", "propose_skill", "leave"]) expect(JSON.stringify(compact)).toContain(`"${kind}"`);
  });

  it("never merges different requirements, bounds, descriptions, or optional discriminators", () => {
    const branch = (kind: string) => ({ type: "object", properties: { kind: { type: "string", const: kind }, text: { type: "string", maxLength: 40 } }, required: ["kind"], additionalProperties: false });
    const original = { anyOf: [branch("a"), { ...branch("b"), required: ["kind", "text"] },
      { ...branch("c"), properties: { ...branch("c").properties, text: { type: "string", maxLength: 80 } } },
      { ...branch("d"), description: "Different meaning" }, { ...branch("e"), required: [] }] };
    const compact = compactActionSchema(original) as Node;
    expect(compact.anyOf).toHaveLength(5);
    expect(expanded(compact)).toEqual(expanded(original));
  });
});
