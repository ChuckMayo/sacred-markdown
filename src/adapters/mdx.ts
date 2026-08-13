import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import { parseSacred } from "../protocol/core";
import type { ParseResult } from "../protocol/types";

const COMPONENTS: Record<string, string> = {
  SacredStatus: "status",
  SacredProgress: "progress",
  SacredAction: "action",
};

interface MdxAttribute {
  type: string;
  name?: string;
  value?: unknown;
}

function attributeValue(attribute: MdxAttribute): unknown {
  if (typeof attribute.value === "string" || typeof attribute.value === "number") return attribute.value;
  return undefined;
}

function encodeDirective(capability: string, attributes: MdxAttribute[], body = ""): string {
  const mapped = Object.fromEntries(
    attributes
      .filter((attribute) => attribute.type === "mdxJsxAttribute" && attribute.name)
      .map((attribute) => [attribute.name as string, attributeValue(attribute)]),
  );
  const id = typeof mapped.id === "string" ? `#${mapped.id}` : "";
  const props = Object.entries(mapped)
    .filter(([key, value]) => key !== "id" && value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === "number" ? value : JSON.stringify(value)}`)
    .join(" ");
  return `:::${capability} {${[id, props].filter(Boolean).join(" ")}}\n${body}\n:::`;
}

export async function parseTrustedMdx(
  source: string,
  options: { trust: "local" | "untrusted" },
): Promise<ParseResult> {
  if (options.trust !== "local") {
    const result = parseSacred("");
    result.document.sourceSyntax = "mdx";
    result.diagnostics.push({
      code: "mdx.trust.required",
      message: "MDX is executable and requires an explicit trusted local boundary.",
      severity: "error",
    });
    return result;
  }

  const tree = unified().use(remarkParse).use(remarkMdx).parse(source) as unknown as {
    children: Array<Record<string, unknown>>;
  };
  const fragments: string[] = [];
  for (const node of tree.children) {
    if (node.type === "mdxJsxFlowElement" && typeof node.name === "string" && COMPONENTS[node.name]) {
      const body = Array.isArray(node.children)
        ? node.children
            .map((child) => (typeof child === "object" && child && "value" in child ? String((child as { value: unknown }).value) : ""))
            .join("")
        : "";
      fragments.push(encodeDirective(COMPONENTS[node.name], (node.attributes ?? []) as MdxAttribute[], body));
      continue;
    }
    const position = node.position as { start?: { offset?: number }; end?: { offset?: number } } | undefined;
    if (position?.start?.offset !== undefined && position.end?.offset !== undefined) {
      fragments.push(source.slice(position.start.offset, position.end.offset));
    }
  }
  const parsed = parseSacred(fragments.join("\n\n"), {
    sacred: "0.1",
    syntax: "mdx",
    capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
    allowedActions: [],
  });
  parsed.document.sourceSyntax = "mdx";
  return parsed;
}
