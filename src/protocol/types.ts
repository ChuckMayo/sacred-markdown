export type SacredTone = "neutral" | "info" | "success" | "warning" | "critical";

export interface SourceSpan {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

export interface SacredDiagnostic {
  code: string;
  message: string;
  severity: "error" | "warning";
  nodeId?: string;
  span?: SourceSpan;
}

export interface SacredFrontmatter {
  sacred: string;
  syntax?: "sacred" | "markdoc" | "mdx";
  components?: string;
  theme?: string;
  capabilities?: string[];
}

export interface SacredNodeBase {
  id: string;
  kind: string;
  span?: SourceSpan;
}

export interface SacredDocumentNode extends SacredNodeBase {
  kind: "document";
  children: string[];
}

export interface SacredProseNode extends SacredNodeBase {
  kind: "prose";
  markdown: string;
}

export interface SacredStatusNode extends SacredNodeBase {
  kind: "status";
  props: { label: string; value: string; tone?: SacredTone };
}

export interface SacredProgressNode extends SacredNodeBase {
  kind: "progress";
  props: { label?: string; value: number; max: number; tone?: SacredTone };
}

export interface SacredActionNode extends SacredNodeBase {
  kind: "action";
  props: { name: string; label: string; payload: Record<string, unknown> };
}

export interface SacredUnsupportedNode extends SacredNodeBase {
  kind: "unsupported";
  capability: string;
  raw: string;
  fallback: string;
}

export type SacredNode =
  | SacredDocumentNode
  | SacredProseNode
  | SacredStatusNode
  | SacredProgressNode
  | SacredActionNode
  | SacredUnsupportedNode;

export interface SacredDocument {
  sacred: "0.1";
  sourceSyntax: "sacred" | "markdoc" | "mdx";
  root: string;
  frontmatter: SacredFrontmatter;
  nodes: Record<string, SacredNode>;
}

export interface ParseResult {
  document: SacredDocument;
  diagnostics: SacredDiagnostic[];
}

export interface CapabilityContract {
  sacred: "0.1";
  syntax: "sacred" | "markdoc" | "mdx";
  capabilities: Record<string, string>;
  allowedActions: string[];
}
