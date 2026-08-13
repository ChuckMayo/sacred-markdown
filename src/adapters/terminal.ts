import type { SacredDocument } from "../protocol/types";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  blue: "\u001b[34m",
};

export function renderTerminal(document: SacredDocument, color = true): string {
  const style = (code: keyof typeof ANSI, text: string) => (color ? `${ANSI[code]}${text}${ANSI.reset}` : text);
  const root = document.nodes[document.root];
  if (!root || root.kind !== "document") return "";
  return root.children
    .map((id) => {
      const node = document.nodes[id];
      if (!node) return "";
      if (node.kind === "prose") {
        return node.markdown
          .replace(/^#\s+(.+)$/gm, (_, title: string) => style("bold", title.toUpperCase()))
          .replace(/\*\*([^*]+)\*\*/g, "$1");
      }
      if (node.kind === "status") {
        const tone = node.props.tone === "critical" ? "red" : node.props.tone === "warning" ? "yellow" : node.props.tone === "success" ? "green" : "blue";
        return `${style(tone, "●")} ${node.props.label.padEnd(16)} ${node.props.value}`;
      }
      if (node.kind === "progress") {
        const ratio = Math.max(0, Math.min(1, node.props.value / node.props.max));
        const filled = Math.round(ratio * 16);
        return `${node.props.label ?? "Progress"}\n[${"█".repeat(filled)}${"░".repeat(16 - filled)}] ${node.props.value}/${node.props.max}`;
      }
      if (node.kind === "action") return `[ ${node.props.label} ]`;
      if (node.kind === "unsupported") return node.fallback;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}
