import { useEffect, useMemo, useState } from "react";
import { parseMarkdoc } from "./adapters/markdoc";
import { parseTrustedMdx } from "./adapters/mdx";
import { renderTerminal } from "./adapters/terminal";
import benchmark from "./generated/benchmark.json";
import { parseSacred } from "./protocol/core";
import type { ParseResult } from "./protocol/types";
import {
  SacredRenderer,
  commonplacePack,
  viberyOperationsPack,
} from "./rendering/react";
import { commandDarkTheme, paperTheme } from "./rendering/themes";

type Syntax = "sacred" | "markdoc" | "mdx";
type View = "vibery" | "commonplace" | "terminal";

const examples: Record<Syntax, string> = {
  sacred: `---
sacred: "0.1"
components: "@vibery/sacred-operations"
theme: "command-dark"
capabilities: [status, progress, action]
---
# Deployment

Two checks remain before this candidate can ship.

:::status {#gateway label="Gateway" value="Operational" tone="success"}
:::

:::progress {#release label="Release" value=8 max=10}
:::

:::action {#review name="open_release" releaseId="release-42"}
Review release
:::`,
  markdoc: `# Deployment

Two checks remain before this candidate can ship.

{% status id="gateway" label="Gateway" value="Operational" tone="success" /%}

{% progress id="release" label="Release" value=8 max=10 /%}`,
  mdx: `# Deployment

Two checks remain before this candidate can ship.

<SacredStatus id="gateway" label="Gateway" value="Operational" tone="success" />

<SacredProgress id="release" label="Release" value="8" max="10" />`,
};

const contract = {
  sacred: "0.1" as const,
  syntax: "sacred" as const,
  capabilities: { status: "^0.1", progress: "^0.1", action: "^0.1" },
  allowedActions: ["open_release"],
};

function percent(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export default function App() {
  const [syntax, setSyntax] = useState<Syntax>("sacred");
  const [source, setSource] = useState(examples.sacred);
  const [view, setView] = useState<View>("vibery");
  const [asyncResult, setAsyncResult] = useState<ParseResult | null>(null);
  const [actionMessage, setActionMessage] = useState("Host action policy is armed.");

  const syncResult = useMemo(() => {
    if (syntax === "markdoc") return parseMarkdoc(source);
    if (syntax === "sacred") return parseSacred(source, contract);
    return null;
  }, [source, syntax]);

  useEffect(() => {
    let live = true;
    if (syntax !== "mdx") {
      setAsyncResult(null);
      return;
    }
    void parseTrustedMdx(source, { trust: "local" }).then((result) => live && setAsyncResult(result));
    return () => {
      live = false;
    };
  }, [source, syntax]);

  const result = syncResult ?? asyncResult;
  const selected = view === "vibery"
    ? { pack: viberyOperationsPack, theme: commandDarkTheme }
    : { pack: commonplacePack, theme: paperTheme };
  const errors = result?.diagnostics.filter((item) => item.severity === "error") ?? [];
  const passed = benchmark.keyResult.successful;

  function selectSyntax(next: Syntax) {
    setSyntax(next);
    setSource(examples[next]);
  }

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Sacred Markdown home">SM<span>0.1</span></a>
        <nav aria-label="Primary navigation">
          <a href="#proof">Proof</a>
          <a href="#protocol">Protocol</a>
          <a href="#registry">Registry</a>
          <a className="nav-source" href="https://github.com/ChuckMayo/sacred-markdown">GitHub ↗</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="rubric">Open protocol · Sacred 0.1</p>
          <h1>Sacred Markdown</h1>
          <p className="thesis">Agents express meaning. Hosts control presentation, capabilities, and actions.</p>
          <p className="hero-note">One streamable document. Many design systems. No executable payload required.</p>
          <div className="hero-actions">
            <a className="primary-link" href="#workbench">Try the protocol</a>
            <a href="https://github.com/ChuckMayo/sacred-markdown">Read the source ↗</a>
          </div>
        </div>
        <aside className={`proof-seal ${passed ? "proof-seal--passed" : "proof-seal--failed"}`} aria-label="Measured benchmark result">
          <span className="proof-seal__label">Measured result</span>
          <strong>{percent(benchmark.keyResult.tokenReductionPercent)}</strong>
          <span>fewer output tokens</span>
          <small>{benchmark.method.tasks} tasks · {benchmark.method.runsPerFormat} runs · {benchmark.method.models.join(", ")}</small>
          <b>{passed ? "quality gate passed" : "quality gate failed"}</b>
        </aside>
        <p className="margin-note">The proof is executable. Edit the source below.</p>
      </section>

      <section className="workbench" id="workbench" aria-labelledby="workbench-title">
        <div className="section-heading">
          <p className="folio">01 / Live instrument</p>
          <h2 id="workbench-title">Write meaning once. Change the host.</h2>
          <p>The same intermediate representation renders through two component packs or a terminal, while the host keeps control of action execution.</p>
        </div>

        <div className="workbench-toolbar">
          <div className="segmented" aria-label="Input syntax">
            {(["sacred", "markdoc", "mdx"] as const).map((item) => (
              <button aria-pressed={syntax === item} key={item} onClick={() => selectSyntax(item)} type="button">{item === "mdx" ? "MDX" : item[0].toUpperCase() + item.slice(1)}</button>
            ))}
          </div>
          <div className="segmented" aria-label="Rendering host">
            {(["vibery", "commonplace", "terminal"] as const).map((item) => (
              <button aria-pressed={view === item} key={item} onClick={() => setView(item)} type="button">{item[0].toUpperCase() + item.slice(1)}</button>
            ))}
          </div>
        </div>

        <div className="workbench-grid">
          <label className="source-pane">
            <span>Source · {syntax}</span>
            <textarea aria-label={`${syntax} source`} onChange={(event) => setSource(event.target.value)} spellCheck={false} value={source} />
          </label>
          <div className="render-pane">
            <div className="pane-label">
              <span>Host · {view}</span>
              <span className={errors.length ? "diagnostic-error" : "diagnostic-ok"}>{errors.length ? `${errors.length} errors` : "contract valid"}</span>
            </div>
            {result && view === "terminal" ? (
              <pre className="terminal-output">{renderTerminal(result.document, false)}</pre>
            ) : result ? (
              <SacredRenderer
                document={result.document}
                pack={selected.pack}
                theme={selected.theme}
                onAction={(name, payload) => setActionMessage(`Host received ${name} · ${JSON.stringify(payload)}`)}
              />
            ) : <p className="loading">Normalizing trusted local MDX…</p>}
            <p className="action-message" aria-live="polite">{actionMessage}</p>
          </div>
        </div>
      </section>

      <section className="proof-band" id="proof" aria-labelledby="proof-title">
        <div className="section-heading section-heading--light">
          <p className="folio">02 / Public proof</p>
          <h2 id="proof-title">A bet with a falsifiable gate.</h2>
        </div>
        <div className="metric-ledger">
          <div><span>Sacred Markdown</span><strong>{benchmark.formats.sacred.meanOutputTokens}</strong><small>mean tokens</small></div>
          <div><span>Flat component JSON</span><strong>{benchmark.formats.json.meanOutputTokens}</strong><small>mean tokens</small></div>
          <div><span>Successful output</span><strong>{percent(benchmark.formats.sacred.successfulPercent)}</strong><small>Sacred · JSON {percent(benchmark.formats.json.successfulPercent)}</small></div>
          <div><span>Contract validity</span><strong>{percent(benchmark.formats.sacred.contractValidityPercent)}</strong><small>{benchmark.formats.sacred.samples} Sacred samples</small></div>
        </div>
        <div className="proof-method">
          <p><b>The result.</b> {benchmark.keyResult.claim}. The key result passes only when Sacred also meets or exceeds the JSON successful-output rate.</p>
          <p><b>The boundary.</b> This small public benchmark measures generated output size and conformance. It does not yet establish latency, user preference, ecosystem adoption, or production reliability.</p>
          <a href="/benchmark.json">Inspect machine-readable evidence ↗</a>
        </div>
      </section>

      <section className="protocol-section" id="protocol" aria-labelledby="protocol-title">
        <div className="section-heading">
          <p className="folio">03 / Phase ledger</p>
          <h2 id="protocol-title">From thesis to distributable protocol.</h2>
        </div>
        <ol className="phase-ledger">
          <li><span>Phase 0</span><h3>Contract</h3><p>Sacred 0.1 grammar, typed IR, capability negotiation, source diagnostics, safe fallbacks, and stream boundaries.</p><b>shipped</b></li>
          <li><span>Phase 1</span><h3>Two hosts</h3><p>Vibery flat-map adapter and a terminal renderer prove the protocol does not belong to React.</p><b>shipped</b></li>
          <li><span>Phase 2</span><h3>Two packs</h3><p>Command-dark operations and Commonplace paper render the same semantics with different visual systems.</p><b>shipped</b></li>
          <li><span>Phase 3</span><h3>Distribution</h3><p>Integrity-addressed manifests, provenance, compatibility checks, discovery, and a registry CLI.</p><b>shipped</b></li>
        </ol>
        <div className="protocol-links">
          <a href="/spec/sacred-0.1.md">Read the protocol ↗</a>
          <a href="/spec/ir.schema.json">Inspect the IR schema ↗</a>
          <a href="https://github.com/ChuckMayo/sacred-markdown/tree/main/tests">Review the conformance suite ↗</a>
        </div>
      </section>

      <section className="registry-band" id="registry" aria-labelledby="registry-title">
        <div>
          <p className="folio">04 / Registry</p>
          <h2 id="registry-title">Distribution without permission escalation.</h2>
          <p>Packs declare renderers, themes, protocol compatibility, integrity, and source provenance. Installation never grants an action. The host still decides.</p>
        </div>
        <pre><code>npm run registry -- list{"\n"}npm run registry -- verify @vibery/sacred-operations</code></pre>
        <a className="primary-link primary-link--light" href="/registry/index.json">Browse registry index</a>
      </section>

      <footer>
        <p><b>Sacred Markdown</b> is an open protocol experiment by Vibery.</p>
        <p>Meaning travels. Authority stays home.</p>
        <a href="https://github.com/ChuckMayo/sacred-markdown">MIT licensed · GitHub ↗</a>
      </footer>
    </main>
  );
}
