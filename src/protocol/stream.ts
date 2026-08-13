import type { CapabilityContract, ParseResult } from "./types";
import { parseSacred } from "./core";

export interface StreamSnapshot extends ParseResult {
  pendingSource: string;
  completeSource: string;
}

function findCompleteBoundary(source: string): number {
  if (source.startsWith("---\n")) {
    const close = source.indexOf("\n---", 4);
    if (close === -1) return 0;
  }

  const linePattern = /.*(?:\n|$)/g;
  let inDirective = false;
  let directiveStart = -1;
  let lastSafe = 0;
  let match: RegExpExecArray | null;
  while ((match = linePattern.exec(source)) && match[0] !== "") {
    const line = match[0].replace(/\n$/, "");
    const lineStart = match.index;
    const lineEnd = match.index + match[0].length;
    if (!inDirective && /^:::[A-Za-z][\w-]*/.test(line)) {
      inDirective = true;
      directiveStart = lineStart;
      continue;
    }
    if (inDirective && /^:::\s*$/.test(line)) {
      inDirective = false;
      directiveStart = -1;
      lastSafe = lineEnd;
      continue;
    }
    if (!inDirective && /^\s*$/.test(line)) lastSafe = lineEnd;
  }
  return inDirective ? Math.min(lastSafe, directiveStart) : lastSafe;
}

export class SacredStreamParser {
  private source = "";

  constructor(private readonly contract?: CapabilityContract) {}

  push(chunk: string): StreamSnapshot {
    this.source += chunk;
    const boundary = findCompleteBoundary(this.source);
    const completeSource = this.source.slice(0, boundary);
    const pendingSource = this.source.slice(boundary);
    return { ...parseSacred(completeSource, this.contract), completeSource, pendingSource };
  }

  finish(): StreamSnapshot {
    return {
      ...parseSacred(this.source, this.contract),
      completeSource: this.source,
      pendingSource: "",
    };
  }
}
