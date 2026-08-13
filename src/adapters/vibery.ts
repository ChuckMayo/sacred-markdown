import { renderMarkdownFallback } from "../protocol/core";
import type { SacredDocument } from "../protocol/types";

export interface ViberyElement {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

export interface ViberySpec {
  root: string;
  elements: Record<string, ViberyElement>;
}

function titleFrom(document: SacredDocument): string {
  const root = document.nodes[document.root];
  if (!root || root.kind !== "document") return "Sacred document";
  for (const id of root.children) {
    const node = document.nodes[id];
    if (node?.kind !== "prose") continue;
    const heading = node.markdown.match(/^#\s+(.+)$/m);
    if (heading) return heading[1].trim();
  }
  return "Sacred document";
}

export function toViberySpec(document: SacredDocument): ViberySpec {
  const rootNode = document.nodes[document.root];
  const elements: Record<string, ViberyElement> = {
    root: { type: "BriefingCard", props: { title: titleFrom(document) }, children: [] },
  };
  if (!rootNode || rootNode.kind !== "document") return { root: "root", elements };
  const children = elements.root.children as string[];

  for (const id of rootNode.children) {
    const node = document.nodes[id];
    if (!node) continue;
    if (node.kind === "prose") {
      const body = node.markdown.replace(/^#\s+.+(?:\n+|$)/, "").trim();
      if (!body) continue;
      elements[id] = { type: "Text", props: { text: body } };
    } else if (node.kind === "status") {
      const variant = node.props.tone === "critical" ? "error" : node.props.tone === "success" ? "success" : node.props.tone === "warning" ? "warning" : "default";
      elements[id] = {
        type: "StatusRow",
        props: { label: node.props.label, value: node.props.value, badge: node.props.tone?.toUpperCase(), badgeVariant: variant },
      };
    } else if (node.kind === "progress") {
      elements[id] = {
        type: "ProgressBar",
        props: { label: node.props.label, value: node.props.value, max: node.props.max, color: node.props.tone === "success" ? "green" : "blue" },
      };
    } else if (node.kind === "action") {
      elements[id] = {
        type: "Button",
        props: { label: node.props.label, action: node.props.name, ...node.props.payload },
      };
    } else if (node.kind === "unsupported") {
      elements[id] = { type: "Text", props: { text: node.fallback } };
    }
    if (elements[id]) children.push(id);
  }

  if (children.length === 0) {
    elements.fallback = { type: "Text", props: { text: renderMarkdownFallback(document) } };
    children.push("fallback");
  }
  return { root: "root", elements };
}
