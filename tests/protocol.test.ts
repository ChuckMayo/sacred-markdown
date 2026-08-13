import { describe, expect, it } from "vitest";
import { parseSacred, renderMarkdownFallback } from "../src/protocol/core";
import type { CapabilityContract } from "../src/protocol/types";

const contract: CapabilityContract = {
  sacred: "0.1",
  syntax: "sacred",
  capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
  allowedActions: ["open_project"],
};

const source = `---
sacred: "0.1"
syntax: sacred
capabilities: [status, progress, action]
---

# Deployment

Two checks remain.

:::status {#gateway label="Gateway" value="Operational" tone="success"}
:::

:::progress {#release label="Release" value=8 max=10}
:::

:::action {#review name="open_project" projectId="release"}
Review release
:::
`;

describe("Sacred 0.1 protocol", () => {
  it("normalizes semantic directives into a stable, non-executable IR", () => {
    const result = parseSacred(source, contract);

    expect(result.diagnostics).toEqual([]);
    expect(result.document.nodes.gateway).toMatchObject({
      id: "gateway",
      kind: "status",
      props: { label: "Gateway", value: "Operational", tone: "success" },
    });
    expect(result.document.nodes.release).toMatchObject({
      kind: "progress",
      props: { label: "Release", value: 8, max: 10 },
    });
    expect(result.document.nodes.review).toMatchObject({
      kind: "action",
      props: {
        name: "open_project",
        label: "Review release",
        payload: { projectId: "release" },
      },
    });
  });

  it("produces a readable Markdown fallback that retains all meaning", () => {
    const { document } = parseSacred(source, contract);
    const fallback = renderMarkdownFallback(document);

    expect(fallback).toContain("# Deployment");
    expect(fallback).toContain("**Gateway:** Operational");
    expect(fallback).toContain("**Release:** 8 / 10");
    expect(fallback).toContain("Review release");
    expect(fallback).not.toContain(":::");
  });

  it("denies actions outside the host contract without discarding their label", () => {
    const denied = source.replace('name="open_project"', 'name="delete_project"');
    const result = parseSacred(denied, contract);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "action.denied", severity: "error", nodeId: "review" }),
    );
    expect(renderMarkdownFallback(result.document)).toContain("Review release");
  });

  it("isolates an invalid directive and preserves valid surrounding blocks", () => {
    const invalid = source.replace("value=8 max=10", 'value="almost" max=10');
    const result = parseSacred(invalid, contract);
    const fallback = renderMarkdownFallback(result.document);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "progress.value.type", nodeId: "release" }),
    );
    expect(fallback).toContain("# Deployment");
    expect(fallback).toContain("**Gateway:** Operational");
    expect(fallback).toContain("Review release");
  });
});
