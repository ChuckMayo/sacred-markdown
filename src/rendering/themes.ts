import type { SacredTheme } from "../registry";

export const commandDarkTheme: SacredTheme = {
  name: "command-dark",
  version: "0.1.0",
  sacred: "^0.1.0",
  tokens: {
    "surface.default": "oklch(18% 0.018 253)",
    "surface.raised": "oklch(23% 0.022 253)",
    "content.primary": "oklch(94% 0.012 80)",
    "content.muted": "oklch(72% 0.018 253)",
    "state.info": "oklch(68% 0.14 245)",
    "state.success": "oklch(72% 0.13 148)",
    "state.warning": "oklch(78% 0.13 82)",
    "state.critical": "oklch(62% 0.19 24)",
    "space.compact": "0.5rem",
    "space.comfortable": "1rem"
  },
};

export const paperTheme: SacredTheme = {
  name: "commonplace-paper",
  version: "0.1.0",
  sacred: "^0.1.0",
  tokens: {
    "surface.default": "oklch(96% 0.018 84)",
    "surface.raised": "oklch(99% 0.009 84)",
    "content.primary": "oklch(24% 0.032 43)",
    "content.muted": "oklch(48% 0.034 43)",
    "state.info": "oklch(48% 0.14 250)",
    "state.success": "oklch(47% 0.12 148)",
    "state.warning": "oklch(58% 0.14 72)",
    "state.critical": "oklch(48% 0.18 25)",
    "space.compact": "0.5rem",
    "space.comfortable": "1.25rem"
  },
};
