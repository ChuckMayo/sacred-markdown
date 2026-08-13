import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const model = process.env.SACRED_BENCH_MODEL || "gpt-5.5";
const repeats = Number(process.env.SACRED_BENCH_REPEATS || "2");
const onlyFormat = process.env.SACRED_BENCH_FORMAT;
const tasks = JSON.parse(readFileSync(resolve("benchmarks/tasks.json"), "utf8"));
const schema = resolve("benchmarks/model-output.schema.json");
const outputDir = resolve("benchmarks/model-runs");
mkdirSync(outputDir, { recursive: true });

const sacredContract = `Output each interface as raw Sacred Markdown 0.1 with no outer code fence.
Use ordinary Markdown plus only these directives:
:::status {#stable-id label="..." value="..." tone="neutral|info|success|warning|critical"}
:::
:::progress {#stable-id label="..." value=NUMBER max=NUMBER}
:::
:::action {#stable-id name="..." requestedPayloadProperty="requested-value"}
Human-readable label
:::
For actions, preserve every payload property named in the task as an attribute on the action directive (for example projectId="release-42"). Stable IDs are required. Do not use HTML, JSX, JSON, or any capability not requested.`;

const jsonContract = `Output each interface as raw compact JSON with no outer code fence. The JSON must use this exact flat design-system spec:
{"root":"root","elements":{"root":{"type":"BriefingCard","props":{"title":"..."},"children":["child-id"]},"child-id":{"type":"StatusRow|ProgressBar|Button|Text","props":{...}}}}
Allowed component props:
- BriefingCard: title string, optional subtitle string; children IDs.
- StatusRow: label string, value string, optional badge string and badgeVariant default|success|error|warning.
- ProgressBar: label string, value number, max number, optional color blue|green|red|yellow.
- Button: label string, action string, and requested payload properties.
- Text: text string.
Every child ID must exist. No nested element objects, CSS, HTML, JSX, Markdown fences, or unlisted component types.`;

const taskBlock = tasks.map((task, index) => `${index + 1}. [${task.id}] ${task.prompt}`).join("\n");
const codexVersion = execFileSync("codex", ["--version"], { encoding: "utf8" }).trim();

for (const format of ["sacred", "json"]) {
  if (onlyFormat && onlyFormat !== format) continue;
  for (let run = 1; run <= repeats; run += 1) {
    const finalPath = resolve(outputDir, `${model}-${format}-run-${run}.json`);
    const messagePath = resolve(outputDir, `.last-${format}-${run}.json`);
    const contract = format === "sacred" ? sacredContract : jsonContract;
    const prompt = `You are participating in a reproducible interface-format benchmark.

${contract}

Produce exactly one output for each task below. Return a JSON object matching the supplied output schema. Each outputs[].content string contains the raw interface source. Preserve each bracketed id exactly. Do not add commentary.

${taskBlock}`;

    execFileSync(
      "codex",
      [
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--model",
        model,
        "--output-schema",
        schema,
        "--output-last-message",
        messagePath,
        prompt,
      ],
      { stdio: "inherit", env: process.env },
    );

    const raw = JSON.parse(readFileSync(messagePath, "utf8"));
    const record = {
      benchmarkVersion: "0.1.0",
      generatedAt: new Date().toISOString(),
      model,
      codexVersion,
      format,
      run,
      temperature: "provider default",
      tasks: raw.outputs,
    };
    writeFileSync(finalPath, `${JSON.stringify(record, null, 2)}\n`);
  }
}
