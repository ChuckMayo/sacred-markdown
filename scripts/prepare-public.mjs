import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

mkdirSync(resolve("public"), { recursive: true });
cpSync(resolve("spec"), resolve("public/spec"), { recursive: true, force: true });
cpSync(resolve("registry"), resolve("public/registry"), { recursive: true, force: true });
