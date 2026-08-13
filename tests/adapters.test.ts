import { describe, expect, it } from "vitest";
import { parseSacred } from "../src/protocol/core";
import { toViberySpec } from "../src/adapters/vibery";
import { renderTerminal } from "../src/adapters/terminal";
import { parseMarkdoc } from "../src/adapters/markdoc";
import { parseTrustedMdx } from "../src/adapters/mdx";

const sacred = `# Deployment\n\n:::status {#gateway label="Gateway" value="Operational" tone="success"}\n:::\n\n:::progress {#release label="Release" value=8 max=10}\n:::\n`;

describe("renderer and source adapters", () => {
  it("compiles the shared IR into Vibery's flat-map component spec", () => {
    const spec = toViberySpec(parseSacred(sacred).document);

    expect(spec.elements.root.type).toBe("BriefingCard");
    expect(Object.values(spec.elements)).toContainEqual(
      expect.objectContaining({ type: "StatusRow", props: expect.objectContaining({ label: "Gateway" }) }),
    );
    expect(Object.values(spec.elements)).toContainEqual(
      expect.objectContaining({ type: "ProgressBar", props: expect.objectContaining({ value: 8, max: 10 }) }),
    );
  });

  it("renders the same semantics in a non-browser terminal target", () => {
    const output = renderTerminal(parseSacred(sacred).document, false);
    expect(output).toContain("DEPLOYMENT");
    expect(output).toContain("Gateway");
    expect(output).toContain("Operational");
    expect(output).toContain("8/10");
  });

  it("normalizes Markdoc tags into the same Sacred IR", () => {
    const result = parseMarkdoc(`{% status id="gateway" label="Gateway" value="Operational" tone="success" /%}`);
    expect(result.diagnostics).toEqual([]);
    expect(result.document.nodes.gateway).toMatchObject({ kind: "status", props: { value: "Operational" } });
  });

  it("allows declared MDX components only at an explicit trusted boundary", async () => {
    const source = `<SacredStatus id="gateway" label="Gateway" value="Operational" tone="success" />`;
    const denied = await parseTrustedMdx(source, { trust: "untrusted" });
    const trusted = await parseTrustedMdx(source, { trust: "local" });

    expect(denied.diagnostics).toContainEqual(expect.objectContaining({ code: "mdx.trust.required" }));
    expect(denied.document.nodes.gateway).toBeUndefined();
    expect(trusted.document.nodes.gateway).toMatchObject({ kind: "status", props: { value: "Operational" } });
  });
});
