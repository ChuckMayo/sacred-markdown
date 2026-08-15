# What counts as adoption

Sacred Markdown's bet is falsifiable, so "a project adopted it" must be too. A project has
adopted Sacred Markdown when **all five** hold, and the numbers come from an audit over real
artifacts — not from a checklist.

1. **Production surface.** At least one surface in the project's normal flow authors or renders
   Sacred documents. Demos, fixtures, and tests do not count.
2. **Multi-surface fidelity.** Each adopted document renders on at least two materially
   different surfaces (component UI, terminal, plain markdown, email…) with meaning preserved.
   One renderer is integration; two is transportability.
3. **Contract-clean.** Every real document the project produced in the audit window parses
   under the project's negotiated capability contract with zero error-severity diagnostics.
   One malformed document is a failed criterion, not a rounding error.
4. **Unattended.** Documents are produced by the product's own automation (a schedule, a
   pipeline, an agent turn) — not by someone running a script to make the audit pass.
5. **Audited.** A re-runnable script measures 1–4 and fails loudly when any criterion fails.
   If the numbers can't be regenerated, they don't exist.

## Verdicts

- **ADOPTED** — all five criteria hold, with numbers.
- **PARTIAL** — name the failing criterion; partial with an unnamed gap is just marketing.
- **NOT ADOPTED** — no production surface.
- **N/A** — the project has no agent-authored interface content to carry (a game engine's
  render loop, a dormant repo). N/A requires a stated justification; it is an honest verdict,
  not an escape hatch. Forcing a decorative integration to avoid N/A is adoption theater and
  scores worse than N/A.

`npm run render -- <file>` exits nonzero on error-severity diagnostics, which gives audits a
minimal contract-clean check per document out of the box.
