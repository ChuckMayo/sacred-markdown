# Sacred Markdown benchmark

Generated: 2026-08-13T11:43:15.798Z

## Key result

**37.4% fewer output tokens than the equivalent flat JSON design-system format.**

| Format | Samples | Mean output tokens | Syntax valid | Contract valid | Content complete | Successful |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sacred Markdown | 16 | 75.4 | 100% | 100% | 100% | 100% |
| Flat JSON | 16 | 120.5 | 100% | 100% | 100% | 100% |

Gate: output-token reduction must be positive and Sacred Markdown's successful-output rate must be at least the JSON baseline.

Method: 8 tasks × 2 independent runs per format using gpt-5.5; tokenized with o200k_base via js-tiktoken. Raw model output is committed under `benchmarks/model-runs/`.
