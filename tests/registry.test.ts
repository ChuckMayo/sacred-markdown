import { describe, expect, it } from "vitest";
import {
  computeIntegrity,
  discoverCapabilities,
  isThemeCompatible,
  resolveDocumentCapabilities,
  verifyIntegrity,
  type SacredPackManifest,
  type SacredTheme,
} from "../src/registry";
import { parseSacred } from "../src/protocol/core";

const baseManifest: SacredPackManifest = {
  name: "@vibery/sacred-operations",
  version: "0.1.0",
  sacred: "^0.1.0",
  capabilities: {
    status: "./schemas/status.schema.json",
    progress: "./schemas/progress.schema.json",
    action: "./schemas/action.schema.json",
  },
  renderers: { react: "./react.js", markdown: "./fallback.js", terminal: "./terminal.js" },
  themes: ["command-dark"],
  provenance: { repository: "https://github.com/ChuckMayo/sacred-markdown", commit: "test" },
};

const compatibleTheme: SacredTheme = {
  name: "command-dark",
  version: "0.1.0",
  sacred: "^0.1.0",
  tokens: { "surface.default": "oklch(18% 0.02 250)", "content.primary": "oklch(94% 0.01 250)" },
};

describe("registry distribution", () => {
  it("produces deterministic integrity metadata and detects tampering", async () => {
    const integrity = await computeIntegrity(baseManifest);
    const signed = { ...baseManifest, integrity };

    expect(integrity).toMatch(/^sha256-[A-Za-z0-9+/=]+$/);
    expect(await verifyIntegrity(signed)).toBe(true);
    expect(await verifyIntegrity({ ...signed, version: "0.1.1" })).toBe(false);
  });

  it("discovers a de-duplicated capability vocabulary", () => {
    expect(discoverCapabilities([baseManifest, { ...baseManifest, name: "@sacred/commonplace" }])).toEqual([
      "action",
      "progress",
      "status",
    ]);
  });

  it("keeps themes presentational and rejects protocol-incompatible themes", () => {
    expect(isThemeCompatible(baseManifest, compatibleTheme)).toBe(true);
    expect(isThemeCompatible(baseManifest, { ...compatibleTheme, sacred: "^2.0.0" })).toBe(false);
  });

  it("reports missing host capabilities instead of silently inventing components", () => {
    const source = `:::status {#gateway label="Gateway" value="Operational"}\n:::\n\n:::decision {#choice label="Ship"}\n:::\n`;
    const resolved = resolveDocumentCapabilities(parseSacred(source).document, baseManifest);

    expect(resolved.supported).toContain("status");
    expect(resolved.missing).toContain("decision");
  });
});
