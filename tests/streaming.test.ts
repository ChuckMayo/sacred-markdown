import { describe, expect, it } from "vitest";
import { SacredStreamParser } from "../src/protocol/stream";
import { parseSacred } from "../src/protocol/core";

const source = `# Release\n\n:::status {#gateway label="Gateway" value="Operational" tone="success"}\n:::\n\n:::action {#review name="open_project" projectId="release"}\nReview release\n:::\n`;

describe("block-level streaming", () => {
  it("never exposes an action before the full directive closes", () => {
    const parser = new SacredStreamParser();
    parser.push(source.slice(0, source.indexOf("Review release") + 6));
    const snapshot = parser.push(" release");

    expect(Object.values(snapshot.document.nodes).some((node) => node.kind === "action")).toBe(false);
    expect(snapshot.pendingSource).toContain(":::action");
  });

  it("is final-parse equivalent across every single-character chunk boundary", () => {
    const parser = new SacredStreamParser();
    for (const character of source) parser.push(character);

    expect(parser.finish().document).toEqual(parseSacred(source).document);
  });

  it("commits completed blocks while retaining only the incomplete tail", () => {
    const parser = new SacredStreamParser();
    const split = source.indexOf(":::action");
    const snapshot = parser.push(source.slice(0, split + 12));

    expect(Object.values(snapshot.document.nodes)).toContainEqual(
      expect.objectContaining({ id: "gateway", kind: "status" }),
    );
    expect(snapshot.completeSource).toContain(":::status");
    expect(snapshot.pendingSource).toContain(":::action");
  });
});
