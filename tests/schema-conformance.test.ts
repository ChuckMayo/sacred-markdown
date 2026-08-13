import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { parseSacred } from "../src/protocol/core";

const load = (name: string) => JSON.parse(readFileSync(resolve("spec", name), "utf8"));

describe("published machine-readable schemas", () => {
  it("accepts the reference parser IR and rejects executable or unknown fields", () => {
    const ajv = new Ajv({ strict: false });
    ajv.addSchema(load("status.schema.json"));
    ajv.addSchema(load("progress.schema.json"));
    ajv.addSchema(load("action.schema.json"));
    const validate = ajv.compile(load("ir.schema.json"));
    const source = `:::status {#gateway label="Gateway" value="Operational" tone="success"}\n:::\n`;
    const document = parseSacred(source).document;

    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...document, execute: "fetch('/secret')" })).toBe(false);
  });
});
