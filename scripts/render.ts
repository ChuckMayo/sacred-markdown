/**
 * Render a Sacred Markdown file from the command line.
 *
 *   npm run render -- path/to/doc.sacred.md            terminal (ANSI) render
 *   npm run render -- path/to/doc.sacred.md --plain    plain-markdown fallback
 *   npm run render -- path/to/doc.sacred.md --source   verbatim source
 *   npm run render -- doc.md --allow-actions open_chat,open_project
 *
 * The host contract allows status/progress/action; actions are denied unless
 * named via --allow-actions (a denied action degrades to its label text, per
 * the protocol). Exits 1 if the document carries error-severity diagnostics,
 * so this doubles as a validity check in scripts and CI.
 */
import fs from "node:fs";
import { parseSacred } from "../src/protocol/core";
import { renderMarkdownFallback } from "../src/protocol/core";
import { renderTerminal } from "../src/adapters/terminal";
import type { CapabilityContract } from "../src/protocol/types";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const plain = args.includes("--plain");
const source = args.includes("--source");
const allowActionsArg = args.find((a) => a.startsWith("--allow-actions"));
const allowedActions = allowActionsArg
  ? (allowActionsArg.split("=")[1] ?? args[args.indexOf(allowActionsArg) + 1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

if (!file) {
  console.error("usage: render <file.sacred.md> [--plain|--source] [--allow-actions=a,b]");
  process.exit(2);
}

const contract: CapabilityContract = {
  sacred: "0.1",
  syntax: "sacred",
  capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
  allowedActions,
};

const text = fs.readFileSync(file, "utf-8");
if (source) {
  process.stdout.write(text);
  process.exit(0);
}

const { document, diagnostics } = parseSacred(text, contract);
const errors = diagnostics.filter((d) => d.severity === "error");
for (const d of diagnostics) {
  console.error(`${d.severity}: ${d.code} — ${d.message}`);
}

const color = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
process.stdout.write((plain ? renderMarkdownFallback(document) : renderTerminal(document, color)) + "\n");
process.exit(errors.length > 0 ? 1 : 0);
