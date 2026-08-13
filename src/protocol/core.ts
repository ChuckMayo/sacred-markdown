import { parse as parseYaml } from "yaml";
import type {
  CapabilityContract,
  ParseResult,
  SacredActionNode,
  SacredDiagnostic,
  SacredDocument,
  SacredFrontmatter,
  SacredNode,
  SacredProgressNode,
  SacredStatusNode,
  SacredTone,
  SacredUnsupportedNode,
  SourceSpan,
} from "./types";

const DIRECTIVE_OPEN = /^:::([A-Za-z][\w-]*)(?:\s+(\{.*\}))?\s*$/;
const DIRECTIVE_CLOSE = /^:::\s*$/;
const VALID_TONES = new Set<SacredTone>(["neutral", "info", "success", "warning", "critical"]);

interface ParsedAttributeSet {
  id?: string;
  values: Record<string, unknown>;
}

interface LineRecord {
  text: string;
  line: number;
  start: number;
  end: number;
}

function linesOf(source: string): LineRecord[] {
  const lines = source.split("\n");
  let offset = 0;
  return lines.map((text, index) => {
    const start = offset;
    const end = start + text.length + (index < lines.length - 1 ? 1 : 0);
    offset = end;
    return { text, line: index + 1, start, end };
  });
}

function spanFor(start: LineRecord, end: LineRecord): SourceSpan {
  return {
    start: { line: start.line, column: 1, offset: start.start },
    end: { line: end.line, column: end.text.length + 1, offset: end.end },
  };
}

function coerceAttribute(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return Number(raw);
  return raw;
}

function parseAttributes(raw = ""): ParsedAttributeSet {
  const result: ParsedAttributeSet = { values: {} };
  const body = raw.trim().replace(/^\{/, "").replace(/\}$/, "");
  const token = /#([A-Za-z][\w-]*)|([A-Za-z][\w-]*)=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s}]+))/g;
  let match: RegExpExecArray | null;
  while ((match = token.exec(body))) {
    if (match[1]) {
      result.id = match[1];
      continue;
    }
    const key = match[2];
    const quoted = match[3] ?? match[4];
    const rawValue = quoted === undefined ? match[5] : quoted.replace(/\\([\\"'])/g, "$1");
    result.values[key] = coerceAttribute(rawValue);
  }
  return result;
}

function addDiagnostic(
  diagnostics: SacredDiagnostic[],
  code: string,
  message: string,
  nodeId: string | undefined,
  span: SourceSpan,
  severity: SacredDiagnostic["severity"] = "error",
): void {
  diagnostics.push({ code, message, severity, nodeId, span });
}

function defaultContract(): CapabilityContract {
  return {
    sacred: "0.1",
    syntax: "sacred",
    capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
    allowedActions: [],
  };
}

function unsupported(
  id: string,
  capability: string,
  raw: string,
  fallback: string,
  span: SourceSpan,
): SacredUnsupportedNode {
  return { id, kind: "unsupported", capability, raw, fallback, span };
}

function parseSemanticNode(
  capability: string,
  attributes: ParsedAttributeSet,
  body: string,
  raw: string,
  index: number,
  span: SourceSpan,
  diagnostics: SacredDiagnostic[],
  contract: CapabilityContract,
): SacredNode {
  const id = attributes.id ?? `${capability}-${index}`;
  const props = attributes.values;

  if (!attributes.id) {
    addDiagnostic(
      diagnostics,
      "node.id.required",
      `The ${capability} capability needs a stable #id for streaming updates.`,
      id,
      span,
      "warning",
    );
  }

  if (!Object.hasOwn(contract.capabilities, capability)) {
    addDiagnostic(
      diagnostics,
      "capability.unsupported",
      `The active host contract does not provide the ${capability} capability.`,
      id,
      span,
    );
    return unsupported(id, capability, raw, body.trim() || raw, span);
  }

  if (capability === "status") {
    const label = props.label;
    const value = props.value;
    if (typeof label !== "string" || typeof value !== "string") {
      addDiagnostic(diagnostics, "status.props.required", "status requires string label and value properties.", id, span);
      return unsupported(id, capability, raw, body.trim() || raw, span);
    }
    if (props.tone !== undefined && (typeof props.tone !== "string" || !VALID_TONES.has(props.tone as SacredTone))) {
      addDiagnostic(diagnostics, "status.tone.invalid", "status tone is not part of the Sacred semantic palette.", id, span);
      return unsupported(id, capability, raw, `**${label}:** ${value}`, span);
    }
    const node: SacredStatusNode = {
      id,
      kind: "status",
      props: { label, value, ...(props.tone ? { tone: props.tone as SacredTone } : {}) },
      span,
    };
    return node;
  }

  if (capability === "progress") {
    const value = props.value;
    const max = props.max ?? 100;
    const label = props.label;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      addDiagnostic(diagnostics, "progress.value.type", "progress value must be a finite number.", id, span);
      return unsupported(id, capability, raw, body.trim() || raw, span);
    }
    if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) {
      addDiagnostic(diagnostics, "progress.max.invalid", "progress max must be a positive finite number.", id, span);
      return unsupported(id, capability, raw, body.trim() || raw, span);
    }
    if (label !== undefined && typeof label !== "string") {
      addDiagnostic(diagnostics, "progress.label.type", "progress label must be a string.", id, span);
      return unsupported(id, capability, raw, body.trim() || raw, span);
    }
    const node: SacredProgressNode = {
      id,
      kind: "progress",
      props: {
        ...(typeof label === "string" ? { label } : {}),
        value,
        max,
        ...(typeof props.tone === "string" && VALID_TONES.has(props.tone as SacredTone)
          ? { tone: props.tone as SacredTone }
          : {}),
      },
      span,
    };
    return node;
  }

  if (capability === "action") {
    const name = props.name;
    const label = body.trim();
    if (typeof name !== "string" || !label) {
      addDiagnostic(diagnostics, "action.props.required", "action requires a name and a human-readable body.", id, span);
      return unsupported(id, capability, raw, label || raw, span);
    }
    if (!contract.allowedActions.includes(name)) {
      addDiagnostic(diagnostics, "action.denied", `The host has not allowed the ${name} action.`, id, span);
      return unsupported(id, capability, raw, label, span);
    }
    const payload = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "name"));
    const node: SacredActionNode = { id, kind: "action", props: { name, label, payload }, span };
    return node;
  }

  addDiagnostic(diagnostics, "capability.unknown", `No Sacred 0.1 normalizer exists for ${capability}.`, id, span);
  return unsupported(id, capability, raw, body.trim() || raw, span);
}

function parseFrontmatter(source: string, records: LineRecord[], diagnostics: SacredDiagnostic[]) {
  const defaultValue: SacredFrontmatter = { sacred: "0.1", syntax: "sacred" };
  if (records[0]?.text.trim() !== "---") return { frontmatter: defaultValue, startIndex: 0 };

  const closeIndex = records.findIndex((line, index) => index > 0 && line.text.trim() === "---");
  if (closeIndex === -1) {
    addDiagnostic(
      diagnostics,
      "frontmatter.unclosed",
      "YAML frontmatter starts with --- but never closes.",
      undefined,
      spanFor(records[0], records.at(-1) ?? records[0]),
    );
    return { frontmatter: defaultValue, startIndex: records.length };
  }

  try {
    const yamlSource = source.slice(records[0].end, records[closeIndex].start);
    const parsed = (parseYaml(yamlSource) ?? {}) as Record<string, unknown>;
    const frontmatter: SacredFrontmatter = {
      sacred: String(parsed.sacred ?? "0.1"),
      syntax: (parsed.syntax as SacredFrontmatter["syntax"]) ?? "sacred",
      ...(typeof parsed.components === "string" ? { components: parsed.components } : {}),
      ...(typeof parsed.theme === "string" ? { theme: parsed.theme } : {}),
      ...(Array.isArray(parsed.capabilities)
        ? { capabilities: parsed.capabilities.map((item) => String(item)) }
        : {}),
    };
    if (frontmatter.sacred !== "0.1") {
      addDiagnostic(
        diagnostics,
        "protocol.version.unsupported",
        `This processor supports Sacred 0.1, not ${frontmatter.sacred}.`,
        undefined,
        spanFor(records[0], records[closeIndex]),
      );
    }
    return { frontmatter, startIndex: closeIndex + 1 };
  } catch (error) {
    addDiagnostic(
      diagnostics,
      "frontmatter.invalid",
      `Invalid YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      spanFor(records[0], records[closeIndex]),
    );
    return { frontmatter: defaultValue, startIndex: closeIndex + 1 };
  }
}

export function parseSacred(sourceInput: string, contractInput?: CapabilityContract): ParseResult {
  const source = sourceInput.replace(/\r\n?/g, "\n");
  const records = linesOf(source);
  const diagnostics: SacredDiagnostic[] = [];
  const contract = contractInput ?? defaultContract();
  const { frontmatter, startIndex } = parseFrontmatter(source, records, diagnostics);
  const nodes: Record<string, SacredNode> = {};
  const children: string[] = [];
  let proseStart = startIndex;
  let proseCount = 0;
  let semanticCount = 0;

  const flushProse = (endExclusive: number) => {
    if (endExclusive <= proseStart) return;
    const raw = source.slice(records[proseStart]?.start ?? source.length, records[endExclusive - 1]?.end ?? source.length);
    const markdown = raw.trim();
    if (!markdown) return;
    proseCount += 1;
    const id = `prose-${proseCount}`;
    nodes[id] = {
      id,
      kind: "prose",
      markdown,
      span: spanFor(records[proseStart], records[endExclusive - 1]),
    };
    children.push(id);
  };

  let index = startIndex;
  while (index < records.length) {
    const open = records[index].text.match(DIRECTIVE_OPEN);
    if (!open || DIRECTIVE_CLOSE.test(records[index].text)) {
      index += 1;
      continue;
    }

    flushProse(index);
    const closeIndex = records.findIndex(
      (record, candidateIndex) => candidateIndex > index && DIRECTIVE_CLOSE.test(record.text),
    );
    if (closeIndex === -1) {
      const id = `${open[1]}-${semanticCount + 1}`;
      addDiagnostic(
        diagnostics,
        "directive.unclosed",
        `The ${open[1]} directive never closes.`,
        id,
        spanFor(records[index], records.at(-1) ?? records[index]),
      );
      const raw = source.slice(records[index].start);
      nodes[id] = unsupported(id, open[1], raw, raw, spanFor(records[index], records.at(-1) ?? records[index]));
      children.push(id);
      proseStart = records.length;
      index = records.length;
      break;
    }

    semanticCount += 1;
    const span = spanFor(records[index], records[closeIndex]);
    const bodyStart = records[index].end;
    const bodyEnd = records[closeIndex].start;
    const body = source.slice(bodyStart, bodyEnd).trim();
    const raw = source.slice(records[index].start, records[closeIndex].end).trim();
    const node = parseSemanticNode(
      open[1],
      parseAttributes(open[2]),
      body,
      raw,
      semanticCount,
      span,
      diagnostics,
      contract,
    );
    let uniqueId = node.id;
    if (nodes[uniqueId]) {
      addDiagnostic(diagnostics, "node.id.duplicate", `Duplicate node id ${uniqueId}.`, uniqueId, span);
      uniqueId = `${uniqueId}-${semanticCount}`;
      node.id = uniqueId;
    }
    nodes[uniqueId] = node;
    children.push(uniqueId);
    index = closeIndex + 1;
    proseStart = index;
  }

  flushProse(records.length);
  nodes.document = { id: "document", kind: "document", children };
  const document: SacredDocument = {
    sacred: "0.1",
    sourceSyntax: (frontmatter.syntax ?? contract.syntax) as SacredDocument["sourceSyntax"],
    root: "document",
    frontmatter,
    nodes,
  };
  return { document, diagnostics };
}

export function validateDocument(document: SacredDocument, contract = defaultContract()): SacredDiagnostic[] {
  const diagnostics: SacredDiagnostic[] = [];
  const root = document.nodes[document.root];
  if (!root || root.kind !== "document") {
    diagnostics.push({ code: "document.root.invalid", message: "Document root is missing or invalid.", severity: "error" });
    return diagnostics;
  }
  for (const childId of root.children) {
    const child = document.nodes[childId];
    if (!child) {
      diagnostics.push({ code: "document.child.missing", message: `Missing child node ${childId}.`, severity: "error", nodeId: childId });
      continue;
    }
    const capability = child.kind === "unsupported" ? child.capability : child.kind;
    if (capability !== "prose" && !Object.hasOwn(contract.capabilities, capability)) {
      diagnostics.push({
        code: "capability.unsupported",
        message: `The active host contract does not provide the ${capability} capability.`,
        severity: "error",
        nodeId: child.id,
        span: child.span,
      });
    }
  }
  return diagnostics;
}

export function renderMarkdownFallback(document: SacredDocument): string {
  const root = document.nodes[document.root];
  if (!root || root.kind !== "document") return "";
  return root.children
    .map((id) => {
      const node = document.nodes[id];
      if (!node) return "";
      if (node.kind === "prose") return node.markdown;
      if (node.kind === "status") return `**${node.props.label}:** ${node.props.value}`;
      if (node.kind === "progress") {
        return `${node.props.label ? `**${node.props.label}:** ` : ""}${node.props.value} / ${node.props.max}`;
      }
      if (node.kind === "action") return node.props.label;
      if (node.kind === "unsupported") return node.fallback;
      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
