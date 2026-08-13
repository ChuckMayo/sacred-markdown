#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registryRoot = resolve(projectRoot, "registry");

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

function integrityFor(manifest) {
  const { integrity: _integrity, ...unsigned } = manifest;
  return `sha256-${createHash("sha256").update(canonicalize(unsigned)).digest("base64")}`;
}

function loadIndex() {
  return JSON.parse(readFileSync(resolve(registryRoot, "index.json"), "utf8"));
}

function resolvePackage(name) {
  const item = loadIndex().packages.find((candidate) => candidate.name === name);
  if (!item) throw new Error(`Unknown registry package: ${name}`);
  const path = resolve(registryRoot, item.manifest);
  if (!path.startsWith(registryRoot)) throw new Error("Registry manifest escaped the registry root.");
  return { item, path, manifest: JSON.parse(readFileSync(path, "utf8")) };
}

const [command = "help", name] = process.argv.slice(2);

if (command === "list") {
  for (const item of loadIndex().packages) console.log(`${item.name}@${item.version}`);
} else if (command === "verify") {
  if (!name) throw new Error("Usage: sacred-markdown verify <package>");
  const { manifest } = resolvePackage(name);
  const expected = integrityFor(manifest);
  if (manifest.integrity !== expected) throw new Error(`${name}: integrity mismatch`);
  console.log(`${name}@${manifest.version}: verified ${manifest.integrity}`);
} else if (command === "install") {
  if (!name) throw new Error("Usage: sacred-markdown install <package>");
  const { manifest } = resolvePackage(name);
  if (manifest.integrity !== integrityFor(manifest)) throw new Error(`${name}: integrity mismatch`);
  const target = resolve(process.cwd(), ".sacred", "registry", `${name.replaceAll("/", "__").replaceAll("@", "")}.json`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Installed ${name}@${manifest.version} to ${basename(target)}`);
} else if (command === "stamp") {
  const commit = name;
  if (!commit || !/^[0-9a-f]{7,40}$/.test(commit)) throw new Error("Usage: sacred-markdown stamp <git-commit>");
  for (const item of loadIndex().packages) {
    const { path, manifest } = resolvePackage(item.name);
    manifest.provenance.commit = commit;
    manifest.integrity = integrityFor(manifest);
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Stamped ${item.name}@${item.version}`);
  }
} else {
  console.log("Sacred Markdown registry\n\nCommands: list, verify <package>, install <package>, stamp <commit>");
}
