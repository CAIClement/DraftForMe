import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".claude/worktrees/**"]
  },
  {
    rules: {
      // User-facing text is French (CLAUDE.md) and uses plain apostrophes
      // throughout ("l'IA", "qu'un", ...); HTML-escaping every one would
      // hurt readability in the source for no benefit to the rendered page.
      "react/no-unescaped-entities": "off"
    }
  }
];

export default eslintConfig;
