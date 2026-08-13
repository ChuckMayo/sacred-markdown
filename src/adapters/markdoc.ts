import Markdoc from "@markdoc/markdoc";
import { parseSacred } from "../protocol/core";
import type { ParseResult, SacredDiagnostic } from "../protocol/types";

function encodeAttributes(attributes: Record<string, unknown>): string {
  const id = typeof attributes.id === "string" ? `#${attributes.id}` : "";
  const rest = Object.entries(attributes)
    .filter(([key]) => key !== "id")
    .map(([key, value]) => `${key}=${typeof value === "number" ? value : JSON.stringify(value)}`)
    .join(" ");
  return `{${[id, rest].filter(Boolean).join(" ")}}`;
}

export function parseMarkdoc(source: string): ParseResult {
  const ast = Markdoc.parse(source);
  const diagnostics: SacredDiagnostic[] = ast.errors.map((error) => ({
    code: `markdoc.${error.id}`,
    message: error.message,
    severity: error.level === "critical" || error.level === "error" ? "error" : "warning",
  }));

  const transformed = source.replace(
    /\{%\s*(status|progress|action)\s+([^%]*?)\s*\/?%\}/g,
    (_match, capability: string, rawAttributes: string) => {
      const wrapper = Markdoc.parse(`{% ${capability} ${rawAttributes} /%}`);
      const node = wrapper.children[0];
      if (!node || node.type !== "tag") return _match;
      return `:::${capability} ${encodeAttributes(node.attributes)}\n:::`;
    },
  );
  const parsed = parseSacred(transformed, {
    sacred: "0.1",
    syntax: "markdoc",
    capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
    allowedActions: [],
  });
  parsed.document.sourceSyntax = "markdoc";
  return { document: parsed.document, diagnostics: [...diagnostics, ...parsed.diagnostics] };
}
