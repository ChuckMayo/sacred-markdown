import { intersects } from "semver";
import type { SacredDocument } from "../protocol/types";

export interface SacredTheme {
  name: string;
  version: string;
  sacred: string;
  tokens: Record<string, string>;
}

export interface SacredPackManifest {
  name: string;
  version: string;
  sacred: string;
  capabilities: Record<string, string>;
  renderers: Record<string, string>;
  themes: string[];
  provenance: { repository: string; commit: string };
  integrity?: string;
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
    .join(",")}}`;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function computeIntegrity(manifest: SacredPackManifest): Promise<string> {
  const { integrity: _integrity, ...unsigned } = manifest;
  const bytes = new TextEncoder().encode(canonicalize(unsigned));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256-${toBase64(new Uint8Array(digest))}`;
}

export async function verifyIntegrity(manifest: SacredPackManifest): Promise<boolean> {
  if (!manifest.integrity) return false;
  return manifest.integrity === (await computeIntegrity(manifest));
}

export function discoverCapabilities(manifests: SacredPackManifest[]): string[] {
  return [...new Set(manifests.flatMap((manifest) => Object.keys(manifest.capabilities)))].sort();
}

export function isThemeCompatible(manifest: SacredPackManifest, theme: SacredTheme): boolean {
  try {
    return manifest.themes.includes(theme.name) && intersects(manifest.sacred, theme.sacred, { includePrerelease: true });
  } catch {
    return false;
  }
}

export function resolveDocumentCapabilities(
  document: SacredDocument,
  manifest: SacredPackManifest,
): { supported: string[]; missing: string[] } {
  const used = new Set<string>();
  for (const node of Object.values(document.nodes)) {
    if (node.kind === "document" || node.kind === "prose") continue;
    used.add(node.kind === "unsupported" ? node.capability : node.kind);
  }
  const supported = [...used].filter((capability) => Object.hasOwn(manifest.capabilities, capability)).sort();
  const missing = [...used].filter((capability) => !Object.hasOwn(manifest.capabilities, capability)).sort();
  return { supported, missing };
}
