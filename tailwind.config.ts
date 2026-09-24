import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        "surface-sunk": "var(--surface-sunk)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "ink-faint": "var(--ink-faint)",
        rule: "var(--rule)",
        "rule-soft": "var(--rule-soft)",
        accent: "var(--accent)",
        "accent-wash": "var(--accent-wash)",
        "accent-deep": "var(--accent-deep)",
        "accent-pale": "var(--accent-pale)",
        "paper-deep": "var(--paper-deep)",
        "on-accent": "var(--on-accent)",
        spark: "var(--spark)",
        danger: "var(--danger)",
        band: "var(--band)",
        "band-ink": "var(--band-ink)",
        "band-muted": "var(--band-muted)",
        "band-rule": "var(--band-rule)",
        "team-ally": "var(--team-ally)",
        "team-enemy": "var(--team-enemy)"
      }
    }
  },
  plugins: []
};

export default config;
