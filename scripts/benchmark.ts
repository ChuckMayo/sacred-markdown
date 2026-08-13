import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getEncoding } from "js-tiktoken";
import { parseSacred } from "../src/protocol/core";

interface Task {
  id: string;
  prompt: string;
  requiredTerms: string[];
  requiredCapabilities: Record<string, number>;
}

interface RunRecord {
  benchmarkVersion: string;
  generatedAt: string;
  model: string;
  codexVersion: string;
  format: "sacred" | "json";
  run: number;
  tasks: Array<{ id: string; content: string }>;
}

interface SampleResult {
  format: "sacred" | "json";
  run: number;
  taskId: string;
  tokens: number;
  syntaxValid: boolean;
  contractValid: boolean;
  contentComplete: boolean;
  successful: boolean;
  diagnostics: string[];
}

const tasks = JSON.parse(readFileSync(resolve("benchmarks/tasks.json"), "utf8")) as Task[];
const tasksById = new Map(tasks.map((task) => [task.id, task]));
const runDir = resolve("benchmarks/model-runs");
const runFiles = readdirSync(runDir).filter((name) => name.endsWith(".json") && !name.startsWith("."));
if (runFiles.length < 2) throw new Error("Benchmark requires recorded Sacred and JSON model runs. Run npm run benchmark:generate.");
const runs = runFiles.map((name) => JSON.parse(readFileSync(resolve(runDir, name), "utf8")) as RunRecord);
if (!runs.some((run) => run.format === "sacred") || !runs.some((run) => run.format === "json")) {
  throw new Error("Benchmark corpus must contain both Sacred and JSON model runs.");
}

const tokenizer = getEncoding("o200k_base");
const allowedTypes = new Set(["BriefingCard", "StatusRow", "ProgressBar", "Button", "Text"]);
const actionNames = [
  "open_release",
  "acknowledge_incident",
  "inspect_build",
  "open_usage",
  "open_review",
  "continue_setup",
  "open_fleet",
  "open_project",
];

function hasTerms(content: string, task: Task): boolean {
  const normalized = content.toLocaleLowerCase();
  return task.requiredTerms.every((term) => normalized.includes(term.toLocaleLowerCase()));
}

function validateSacred(content: string, task: Task) {
  const parsed = parseSacred(content, {
    sacred: "0.1",
    syntax: "sacred",
    capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
    allowedActions: actionNames,
  });
  const errors = parsed.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const counts: Record<string, number> = {};
  for (const node of Object.values(parsed.document.nodes)) counts[node.kind] = (counts[node.kind] ?? 0) + 1;
  const contractValid = Object.entries(task.requiredCapabilities).every(
    ([kind, count]) => (counts[kind] ?? 0) >= count,
  );
  return {
    syntaxValid: errors.every((diagnostic) => !diagnostic.code.startsWith("frontmatter") && !diagnostic.code.startsWith("directive")),
    contractValid: errors.length === 0 && contractValid,
    diagnostics: parsed.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function validateJson(content: string, task: Task) {
  try {
    const spec = JSON.parse(content) as { root?: unknown; elements?: unknown };
    if (typeof spec.root !== "string" || !spec.elements || typeof spec.elements !== "object" || Array.isArray(spec.elements)) {
      return { syntaxValid: true, contractValid: false, diagnostics: ["spec.shape"] };
    }
    const elements = spec.elements as Record<string, { type?: unknown; props?: unknown; children?: unknown }>;
    if (!elements[spec.root]) return { syntaxValid: true, contractValid: false, diagnostics: ["spec.root.missing"] };
    const counts: Record<string, number> = { status: 0, progress: 0, action: 0 };
    const diagnostics: string[] = [];
    for (const [id, element] of Object.entries(elements)) {
      if (typeof element.type !== "string" || !allowedTypes.has(element.type)) diagnostics.push(`element.type:${id}`);
      if (!element.props || typeof element.props !== "object" || Array.isArray(element.props)) diagnostics.push(`element.props:${id}`);
      if (element.type === "StatusRow") counts.status += 1;
      if (element.type === "ProgressBar") counts.progress += 1;
      if (element.type === "Button") counts.action += 1;
      if (Array.isArray(element.children)) {
        for (const child of element.children) if (typeof child !== "string" || !elements[child]) diagnostics.push(`element.child:${id}`);
      }
    }
    const contractValid = diagnostics.length === 0 && Object.entries(task.requiredCapabilities).every(
      ([kind, count]) => (counts[kind] ?? 0) >= count,
    );
    return { syntaxValid: true, contractValid, diagnostics };
  } catch {
    return { syntaxValid: false, contractValid: false, diagnostics: ["json.parse"] };
  }
}

const samples: SampleResult[] = [];
for (const run of runs) {
  for (const output of run.tasks) {
    const task = tasksById.get(output.id);
    if (!task) continue;
    const validation = run.format === "sacred" ? validateSacred(output.content, task) : validateJson(output.content, task);
    const contentComplete = hasTerms(output.content, task);
    samples.push({
      format: run.format,
      run: run.run,
      taskId: task.id,
      tokens: tokenizer.encode(output.content).length,
      syntaxValid: validation.syntaxValid,
      contractValid: validation.contractValid,
      contentComplete,
      successful: validation.syntaxValid && validation.contractValid && contentComplete,
      diagnostics: validation.diagnostics,
    });
  }
}

function summarize(format: "sacred" | "json") {
  const filtered = samples.filter((sample) => sample.format === format);
  const sum = (selector: (sample: SampleResult) => number) => filtered.reduce((total, sample) => total + selector(sample), 0);
  const percentage = (selector: (sample: SampleResult) => boolean) =>
    filtered.length === 0 ? 0 : (sum((sample) => (selector(sample) ? 1 : 0)) / filtered.length) * 100;
  return {
    samples: filtered.length,
    meanOutputTokens: Number((sum((sample) => sample.tokens) / filtered.length).toFixed(1)),
    syntaxValidityPercent: Number(percentage((sample) => sample.syntaxValid).toFixed(1)),
    contractValidityPercent: Number(percentage((sample) => sample.contractValid).toFixed(1)),
    contentCompletenessPercent: Number(percentage((sample) => sample.contentComplete).toFixed(1)),
    successfulPercent: Number(percentage((sample) => sample.successful).toFixed(1)),
  };
}

const sacred = summarize("sacred");
const json = summarize("json");
const tokenReductionPercent = Number(((1 - sacred.meanOutputTokens / json.meanOutputTokens) * 100).toFixed(1));
const generatedAt = new Date().toISOString();
const result = {
  benchmarkVersion: "0.1.0",
  generatedAt,
  method: {
    tokenizer: "o200k_base via js-tiktoken",
    tasks: tasks.length,
    runsPerFormat: Math.min(
      ...["sacred", "json"].map((format) => new Set(runs.filter((run) => run.format === format).map((run) => run.run)).size),
    ),
    models: [...new Set(runs.map((run) => run.model))],
    codexVersions: [...new Set(runs.map((run) => run.codexVersion))],
    source: "benchmarks/model-runs/*.json",
  },
  keyResult: {
    tokenReductionPercent,
    claim: `${tokenReductionPercent}% fewer output tokens than the equivalent flat JSON design-system format`,
    successful: tokenReductionPercent > 0 && sacred.successfulPercent >= json.successfulPercent,
  },
  formats: { sacred, json },
  samples,
};

mkdirSync(resolve("src/generated"), { recursive: true });
mkdirSync(resolve("public"), { recursive: true });
mkdirSync(resolve("benchmarks/results"), { recursive: true });
const jsonOutput = `${JSON.stringify(result, null, 2)}\n`;
writeFileSync(resolve("src/generated/benchmark.json"), jsonOutput);
writeFileSync(resolve("public/benchmark.json"), jsonOutput);
writeFileSync(resolve("benchmarks/results/latest.json"), jsonOutput);
const resultLabel = result.keyResult.successful ? "Key result" : "Candidate result (quality gate failed)";
const markdown = `# Sacred Markdown benchmark\n\nGenerated: ${generatedAt}\n\n## ${resultLabel}\n\n**${result.keyResult.claim}.**\n\n| Format | Samples | Mean output tokens | Syntax valid | Contract valid | Content complete | Successful |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n| Sacred Markdown | ${sacred.samples} | ${sacred.meanOutputTokens} | ${sacred.syntaxValidityPercent}% | ${sacred.contractValidityPercent}% | ${sacred.contentCompletenessPercent}% | ${sacred.successfulPercent}% |\n| Flat JSON | ${json.samples} | ${json.meanOutputTokens} | ${json.syntaxValidityPercent}% | ${json.contractValidityPercent}% | ${json.contentCompletenessPercent}% | ${json.successfulPercent}% |\n\nGate: output-token reduction must be positive and Sacred Markdown's successful-output rate must be at least the JSON baseline.\n\nMethod: ${tasks.length} tasks × ${result.method.runsPerFormat} independent runs per format using ${result.method.models.join(", ")}; tokenized with ${result.method.tokenizer}. Raw model output is committed under \`benchmarks/model-runs/\`.\n`;
writeFileSync(resolve("benchmarks/results/latest.md"), markdown);
console.log(markdown);
