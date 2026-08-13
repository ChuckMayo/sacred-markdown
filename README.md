# Sacred Markdown

**A safe, streamable, human-readable interface protocol for agents and design systems.**

Sacred Markdown is an implemented open-source protocol for turning semantic Markdown into trusted local design-system components.

Agents express meaning. Hosts control presentation, capabilities, and actions.

> Write content once. Render it through any trusted design system.

[Try the live protocol](https://sacred-markdown.vibery.gg) · [Read the normative Sacred 0.1 spec](./spec/sacred-0.1.md) · [Inspect the benchmark evidence](./benchmarks/results/latest.md)

## Status

Sacred Markdown `0.1` now has a parser, typed intermediate representation, JSON Schemas, safe streaming processor, Vibery flat-map adapter, React renderer, terminal renderer, Markdoc and trusted-local MDX adapters, two component packs, registry tooling, and a public conformance benchmark.

Phases 0 through 3 are shipped as a proof of concept. Vibery is the first proving ground, not a required runtime.

The first public benchmark passed its quality gate: across 8 representative interface tasks and 2 independent runs per format with `gpt-5.5`, Sacred Markdown used **37.4% fewer mean output tokens** than the equivalent flat component JSON while both formats achieved 100% syntax validity, contract validity, content completeness, and successful output. Raw outputs and the scoring code are committed so the claim can be reproduced or challenged.

## Run it locally

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm run typecheck
npm run benchmark
npm run dev
```

The benchmark command scores the committed independent model outputs without making network calls. `npm run benchmark:generate` records a fresh corpus through the locally authenticated Codex CLI.

Registry commands are local and integrity checked:

```sh
npm run registry -- list
npm run registry -- verify @vibery/sacred-operations
npm run registry -- install @sacred/commonplace
```

## The thesis

Agents are already excellent Markdown authors. Markdown is compact, familiar, streamable, diffable, durable, and readable even when no special renderer is present.

Modern agent interfaces, however, increasingly need more than prose. They need status, progress, decisions, approvals, artifacts, actions, and other interactive structures. Today those structures are commonly expressed as verbose JSON trees, framework-specific component code, or executable MDX.

Each approach loses something important:

- JSON UI trees are token-heavy, difficult for humans to edit, and brittle while streaming.
- Framework component code couples content to one renderer and creates an unsafe execution boundary.
- Plain Markdown is portable, but lacks a shared vocabulary for application-level interface semantics.

Sacred Markdown proposes a missing layer: a small semantic protocol above Markdown and below design-system components.

```text
agent or human author
        |
        v
Sacred Markdown source
        |
        v
parse + validate + normalize
        |
        v
Sacred semantic IR
        |
        v
resolve against installed capabilities
        |
        +----------+-----------+----------+---------+
        v          v           v          v
      Vibery     React       email      terminal
```

The source remains meaningful Markdown. The host resolves its semantic structures into components that are already installed, trusted, themed, and permitted in that environment.

## The bet

We believe agents will prefer a constrained semantic Markdown contract over generated component trees when it provides:

- fewer output tokens;
- a higher first-pass validity rate;
- useful progressive rendering;
- deterministic validation and repair;
- graceful plain-Markdown fallback;
- host-selected theming;
- a small negotiated capability set;
- no arbitrary code execution.

We also believe design-system authors will want to distribute capabilities rather than isolated visual components.

A capability such as `status` can be implemented as a diagnostic row in Vibery, a dashboard tile in another application, a table row in email, or a line of text in a terminal. The document communicates what the interface means without prescribing how every target must draw it.

The bet is falsifiable. Early implementations should measure:

1. tokens required compared with equivalent JSON UI specs;
2. valid first-pass generation rate;
3. time to first meaningful render;
4. repair success after invalid output;
5. readability without a Sacred renderer;
6. portability across at least two component packs;
7. action-policy violations prevented by the host.

If Sacred Markdown does not materially improve those outcomes, another format should win.

## Design principles

### Meaning before presentation

Authors select semantic capabilities such as `status`, `progress`, and `action`. They do not select CSS classes, React components, or implementation details.

### Safe by default

Untrusted streamed content cannot import packages, evaluate JavaScript, register components, or expand its own permissions.

### One generation contract at a time

The platform may support Markdown, Markdoc, MDX, and other inputs. An individual agent request receives one selected syntax, one capability manifest, and one action policy. Agents are not asked to choose among equivalent encodings while generating a response.

### Local components, portable documents

Documents reference capabilities. The host resolves those capabilities to locally installed components. A streamed document never downloads and executes arbitrary component code.

### Graceful degradation

Every core capability has a readable Markdown fallback. Unsupported or invalid enhancements must not erase the surrounding content.

### Explicit composition boundaries

Different source formats can coexist through declared document islands or includes. Parsers are not implicitly mixed inside the same block.

### Themes cannot grant authority

Themes may affect visual presentation. They cannot change action semantics, data access, trust level, or permission policy.

## A first document

```md
---
sacred: "0.1"
syntax: sacred
components: vibery/operations@^0.1
theme: vibery/command-dark@^0.1
capabilities:
  - status
  - progress
  - action
---

# Deployment

The release is moving normally. Two checks remain.

:::status {#gateway label="Gateway" value="Operational" tone="success"}
:::

:::progress {#release label="Release" value=8 max=10}
:::

:::action {#review name="open_project" projectId="release"}
Review release
:::
```

Without a Sacred-aware renderer, a processor can reduce this to:

```md
# Deployment

The release is moving normally. Two checks remain.

**Gateway:** Operational

**Release:** 8 / 10

Review release
```

With Vibery's component pack installed, the same semantic nodes might resolve to `BriefingCard`, `StatusRow`, `ProgressBar`, and a locally authorized action button.

## Sacred 0.1 specification

The normative protocol and machine-readable schemas live in [`spec/`](./spec/). The following is the thesis-level specification and rationale retained alongside the implementation.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** describe protocol requirements in this draft.

### 1. Document model

A Sacred document consists of:

1. optional YAML frontmatter;
2. ordinary Markdown content;
3. optional semantic directives;
4. an optional set of explicit format islands;
5. zero or more requested capabilities.

Ordinary Markdown MUST remain valid authoring content. A Sacred implementation MUST preserve content it does not enhance, subject to ordinary sanitization policies.

### 2. Frontmatter

The `sacred` field opts a document into this protocol.

| Field | Required | Meaning |
| --- | --- | --- |
| `sacred` | yes | Protocol version used by the document. |
| `syntax` | no | Source adapter. Defaults to `sacred`. |
| `components` | no | Requested component pack and compatible version. |
| `theme` | no | Requested theme and compatible version. |
| `capabilities` | no | Capabilities the document expects to use. |

The host MAY override `components` and `theme`. The host MUST NOT silently expand action permissions based on frontmatter.

### 3. Directives

The draft Sacred syntax uses fenced directives:

```md
:::capability {#optional-id prop="value" count=3}
Optional Markdown body
:::
```

A directive has:

- a capability name;
- an optional stable identifier prefixed with `#`;
- zero or more typed properties;
- an optional Markdown body;
- an explicit closing fence.

Implementations MUST validate directive properties against the active capability manifest. Unknown properties SHOULD produce diagnostics and MUST NOT be forwarded blindly to component implementations.

Stateful or actionable nodes MUST have a stable identifier. A processor MAY derive identifiers for static nodes from document identity and source position.

### 4. Core capabilities

Draft `0.1` defines a deliberately small core.

#### `status`

Communicates a labeled state.

| Property | Type | Required |
| --- | --- | --- |
| `label` | string | yes |
| `value` | string | yes |
| `tone` | `neutral`, `info`, `success`, `warning`, or `critical` | no |

Fallback: `**{label}:** {value}`.

#### `progress`

Communicates bounded progress.

| Property | Type | Required |
| --- | --- | --- |
| `label` | string | no |
| `value` | number | yes |
| `max` | positive number | no; defaults to `100` |
| `tone` | semantic tone | no |

`value` MUST be finite. Renderers SHOULD clamp visual presentation to the interval from `0` through `max` while retaining the original value in diagnostics.

Fallback: `**{label}:** {value} / {max}`.

#### `action`

Requests a host-defined action.

| Property | Type | Required |
| --- | --- | --- |
| `name` | string | yes |
| additional payload | manifest-defined | no |

The directive body is the human-readable label and fallback.

An action MUST be declared by the active capability manifest and allowed by host policy. Documents cannot define new executable actions. Unknown, malformed, or denied actions MUST degrade to non-interactive content.

### 5. Sacred intermediate representation

All input adapters normalize into a framework-neutral Sacred IR before component resolution.

```json
{
  "sacred": "0.1",
  "root": "document",
  "nodes": {
    "document": {
      "kind": "document",
      "children": ["heading-1", "gateway", "release", "review"]
    },
    "heading-1": {
      "kind": "prose",
      "format": "mdast",
      "value": { "type": "heading", "depth": 1 }
    },
    "gateway": {
      "kind": "status",
      "props": {
        "label": "Gateway",
        "value": "Operational",
        "tone": "success"
      }
    },
    "release": {
      "kind": "progress",
      "props": { "label": "Release", "value": 8, "max": 10 }
    },
    "review": {
      "kind": "action",
      "props": {
        "name": "open_project",
        "payload": { "projectId": "release" },
        "label": "Review release"
      }
    }
  }
}
```

The example is illustrative. Before `0.1` is declared stable, the project must publish a machine-readable schema and conformance fixtures that define the exact IR.

The IR MUST contain data, not executable code. Renderers MUST resolve node kinds through an explicit registry.

### 6. Processing model

A conforming processor performs these stages:

1. Parse and validate frontmatter.
2. Select the host-approved source adapter.
3. Parse source into that adapter's syntax tree.
4. Normalize recognized structures into Sacred IR.
5. Validate every semantic node against the negotiated capability manifest.
6. Apply trust and action policies.
7. Resolve supported nodes against the installed component pack.
8. Render unsupported nodes through their Markdown fallback.
9. Emit diagnostics without discarding valid surrounding content.

Component resolution MUST happen after policy enforcement.

### 7. Streaming

Sacred Markdown is designed for block-level incremental rendering.

- A processor MAY render complete Markdown blocks as soon as they are stable.
- A directive MUST NOT become interactive until its opening fence, properties, body, and closing fence validate.
- An incomplete directive SHOULD remain a non-interactive pending block rather than expose raw executable behavior.
- A completed block with a stable identifier SHOULD update in place rather than append a duplicate.
- Parse errors inside one directive MUST NOT invalidate previously completed blocks.
- The final non-streaming parse MUST produce a result equivalent to the completed streaming parse.

Streaming conformance fixtures will cover chunk boundaries within fences, attributes, Unicode sequences, links, and directive bodies.

### 8. Capability negotiation

The host gives an agent or authoring tool a bounded generation contract:

```yaml
sacred: "0.1"
syntax: sacred
capabilities:
  status: "^0.1"
  progress: "^0.1"
  action: "^0.1"
allowedActions:
  - open_project
```

An agent SHOULD generate only capabilities present in that contract. The host MUST still validate the output; prompt instructions are not a security boundary.

Large registries SHOULD expose retrieval or selection mechanisms so an entire component catalog does not have to be placed in every model prompt.

### 9. Component packs and themes

A **component pack** maps semantic capabilities to trusted implementations for a target renderer.

A **theme** supplies visual tokens and presentation policy to a component pack.

They are deliberately separate:

```text
status capability
      |
      v
Vibery operations component pack
      |
      +---- command-dark theme
      |
      +---- command-light theme
```

Themes MAY define semantic color tokens, typography, density, shape, motion, and layout preferences. Themes MUST NOT introduce actions, alter payloads, access data, or bypass component schemas.

The first theme token vocabulary should be small and semantic, for example:

- `surface.default`
- `surface.raised`
- `content.primary`
- `content.muted`
- `state.info`
- `state.success`
- `state.warning`
- `state.critical`
- `space.compact`
- `space.comfortable`

Raw CSS is an implementation detail, not part of a Sacred document.

### 10. Input adapters

Sacred Markdown is a shared semantic layer, not a requirement that every author use one parser.

#### Sacred Markdown adapter

The default declarative syntax in this document. It is intended for untrusted agent streaming.

#### Markdoc adapter

Markdoc tags and nodes can normalize into Sacred capabilities. Because Markdoc is declarative and schema-oriented, it is a natural compatibility target.

#### MDX adapter

MDX is executable. Full MDX support MUST be treated as trusted code, not untrusted streamed content.

An MDX component can participate portably by declaring a Sacred capability manifest and a normalization strategy. Otherwise it remains an opaque, renderer-specific island available only in a trusted local or build-time context.

#### Mixed-format documents

Mixed formats require explicit boundaries:

```md
:::include {syntax="markdoc" source="./risks.md"}
:::

:::include {syntax="mdx" source="./revenue-chart.mdx" trust="local"}
:::
```

Includes are reserved in draft `0.1`; their loading, path, integrity, and sandboxing behavior is not yet standardized. Implementations MUST NOT treat the example as permission to load arbitrary remote content.

### 11. Trust model

Sacred distinguishes three execution classes:

| Class | Typical inputs | May stream from an untrusted agent? | May execute code? |
| --- | --- | --- | --- |
| Declarative | Markdown, Sacred directives | yes | no |
| Schema-declarative | Markdoc with an approved schema | yes, after validation | no |
| Executable | MDX, framework components | no | yes, only under host policy |

Security requirements:

- Documents MUST NOT import or download executable components.
- Component packs MUST be installed or otherwise trusted by the host.
- Action handlers MUST be registered locally and checked against host policy.
- URLs and rich content MUST pass the host's sanitization policy.
- Renderers MUST bound recursion, output size, and expensive component behavior.
- Registries SHOULD support version pinning, integrity metadata, and provenance.
- A theme MUST never be treated as an authority boundary.

### 12. Registry and distribution

A Sacred registry distributes interface capabilities and their implementation metadata.

A registry item may contain:

- capability schemas;
- component bindings for one or more renderers;
- themes and semantic tokens;
- agent prompt fragments;
- Markdown examples;
- conformance fixtures;
- accessibility requirements;
- allowed action schemas;
- compatibility and migration metadata;
- optional installable component source.

Conceptual manifest:

```json
{
  "name": "@vibery/sacred-operations",
  "version": "0.1.0",
  "sacred": "^0.1",
  "capabilities": {
    "status": "./schemas/status.json",
    "progress": "./schemas/progress.json",
    "action": "./schemas/action.json"
  },
  "renderers": {
    "react": "./react/registry.js",
    "markdown": "./fallbacks.js"
  },
  "themes": ["command-dark", "command-light"],
  "integrity": "sha256-..."
}
```

The registry is a distribution mechanism, not a runtime permission grant. Installation does not automatically allow every action exposed by a package.

## Relationship to existing formats

Sacred Markdown should interoperate with existing work rather than pretend the surrounding ecosystem does not exist.

### Markdown

Markdown is the durable source substrate and universal fallback.

### MDX

MDX embeds JSX and JavaScript in Markdown. It is an excellent trusted authoring environment and an important adapter target. It is not safe as an untrusted agent wire format without severe constraints.

### Markdoc

Markdoc adds declarative tags, schemas, validation, and renderable nodes without mixing arbitrary code into content. It is the closest conceptual neighbor and may provide implementation leverage for an early adapter.

### JSON-based generative UI

Catalog-constrained JSON trees are a strong machine representation and may remain an excellent renderer IR. Sacred Markdown focuses on the authoring and interchange layer: readable source, semantic portability, and streaming degradation.

### Component registries

Existing registries distribute component source and configuration. Sacred registries add semantic capability schemas, prompt contracts, fallbacks, policies, and cross-renderer bindings.

## Vibery as the first proving ground

Vibery already renders constrained agent-generated UI from a local component catalog. Sacred Markdown can begin as an additional input adapter that compiles to Vibery's existing flat component specification.

The first vertical slice should support:

1. `status`;
2. `progress`;
3. `action`;
4. a Vibery operations component pack;
5. the command-dark theme;
6. dual support for existing JSON specs and Sacred Markdown;
7. one deterministic product surface such as a daily briefing or evening wrap-up;
8. measurements against the current JSON generation path.

Vibery can eventually become a curator and distributor of component packs, themes, and operational interface capabilities without making Sacred Markdown dependent on Vibery.

## Package map

```text
@sacred-markdown/core
@sacred-markdown/adapter-markdown
@sacred-markdown/adapter-markdoc
@sacred-markdown/adapter-mdx
@sacred-markdown/stream
@sacred-markdown/registry
@sacred-markdown/react
@sacred-markdown/theme-vibery
```

The proof of concept keeps these boundaries inside one repository. They describe intended package seams; no npm packages have been published yet.

## Roadmap

### Phase 0: contract — shipped

- Collect equivalent Markdown, Sacred, and JSON fixtures.
- Define the exact `0.1` grammar.
- Publish the Sacred IR JSON Schema.
- Publish core capability schemas.
- Build a validator with human-readable diagnostics.
- Measure token use and model validity across representative prompts.

### Phase 1: renderer — shipped

- Build a streaming parser.
- Build Markdown fallback rendering.
- Build the Vibery adapter and reference component pack.
- Verify stable updates across adversarial chunk boundaries.
- Add Storybook examples and accessibility checks.

### Phase 2: portability — shipped

- Add a second, visually distinct React component pack.
- Add a non-React or non-browser renderer.
- Add a Markdoc adapter.
- Specify themes and compatibility behavior.

### Phase 3: distribution — shipped

- Publish the registry manifest schema.
- Add integrity and provenance metadata.
- Publish installation and capability-discovery tooling.
- Add trusted MDX interoperability without weakening the declarative path.

## Non-goals

Sacred Markdown is not intended to be:

- a replacement for CommonMark;
- a general-purpose programming language;
- a way to stream and execute arbitrary React components;
- a CSS-in-Markdown format;
- a remote-code delivery mechanism;
- a universal design system;
- a blockchain protocol;
- a reason to rewrite stable Markdown, MDX, or Markdoc tooling.

## Open questions

- Should the default syntax use fenced directives, Markdoc tags, or a smaller CommonMark-compatible profile?
- Which parts of the IR should be normative versus renderer-defined?
- How should stable IDs work when an agent revises an earlier block?
- What is the minimum useful capability set beyond `status`, `progress`, and `action`?
- Can themes remain portable without collapsing into lowest-common-denominator design tokens?
- Should registry distribution align directly with an existing component registry format?
- What conformance suite best predicts reliability under real token streaming?
- How should documents declare data bindings without becoming executable templates?

## Contributing

This project is deliberately early. Useful contributions include:

- adversarial syntax examples;
- streaming chunk fixtures;
- comparisons with existing formats;
- capability schema proposals;
- security and trust-model critiques;
- renderer experiments;
- evidence that falsifies the bet.

Please begin substantial changes with an issue or discussion that identifies the user, capability, and portability problem being addressed.

## License

MIT. See [`LICENSE`](./LICENSE).
