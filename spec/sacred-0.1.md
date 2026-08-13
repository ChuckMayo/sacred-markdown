# Sacred Markdown 0.1 grammar

Status: draft, implemented by the reference parser and conformance suite.

This document defines the exact source grammar implemented by Sacred Markdown `0.1`. The normative machine form is [`ir.schema.json`](./ir.schema.json).

## Document

```text
document       = [ frontmatter ] *( markdown-block / directive )
frontmatter    = "---" newline yaml newline "---" newline
directive      = directive-open newline *directive-body directive-close
directive-open = ":::" capability [ space attributes ]
directive-close= ":::" *space newline
capability     = alpha *( alpha / digit / "-" / "_" )
attributes     = "{" *( stable-id / property ) "}"
stable-id      = "#" alpha *( alpha / digit / "-" / "_" )
property       = name "=" ( quoted-string / number / boolean / bare-string )
name           = alpha *( alpha / digit / "-" / "_" )
```

`newline` is normalized to LF before parsing. UTF-8 is the source encoding.

Directive open and close markers occupy their own lines. Nested Sacred directives are not part of `0.1`; a directive body is ordinary Markdown content up to the next close marker. Processors preserve unknown directives as unsupported nodes with readable fallback content and diagnostics.

## Frontmatter

The optional YAML map accepts:

- `sacred`: protocol version; `0.1` is the only supported value;
- `syntax`: `sacred`, `markdoc`, or `mdx`;
- `components`: requested component pack plus version range;
- `theme`: requested theme plus version range;
- `capabilities`: requested semantic capability names.

The host may override component and theme requests. Frontmatter never grants an action permission.

## Stable identifiers

Semantic nodes should declare a stable identifier using `#id`. The reference parser derives a deterministic source-order identifier when one is absent and emits `node.id.required`. Actionable or stateful hosts may reject the derived identifier.

Identifiers are document-local. Duplicate identifiers emit `node.id.duplicate`; the reference parser retains both nodes by suffixing the later internal ID.

## Attribute values

- Double-quoted and single-quoted strings support escaped quote and backslash characters.
- Bare `true` and `false` become booleans.
- A finite decimal literal becomes a number.
- Other bare values remain strings.
- Unknown properties are not forwarded blindly to component implementations.

## Core capabilities

The core schemas are:

- [`status.schema.json`](./status.schema.json)
- [`progress.schema.json`](./progress.schema.json)
- [`action.schema.json`](./action.schema.json)

Every other capability requires an installed manifest and a normalizer. Unsupported capabilities degrade to their directive body when present, or their raw directive otherwise.

## Streaming equivalence

A streaming processor commits complete Markdown blocks and complete directives. It does not expose an action until the entire directive validates. Calling `finish()` on a complete stream must return the same Sacred IR as a non-streaming parse of the concatenated source.

## Trust

Sacred source is declarative data. It cannot import modules, evaluate expressions, register component implementations, or broaden the host action policy. Markdoc and MDX adapters normalize into the same IR, but full MDX requires an explicit trusted local boundary.
