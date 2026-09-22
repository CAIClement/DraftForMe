---
active: paths
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
---

# UI

- **Colours only through tokens.** Never hardcode `text-white`, `bg-stone-*`, a hex value, or `rgb()` in a component; add or reuse a CSS variable in `src/app/globals.css` and its Tailwind name in `tailwind.config.ts`. The Hextech palette (navy, gold, cyan focus) changes in one place.
- **User-facing text is French**, and must stay true: never show an estimated or invented number. When data is missing, hide the element — don't fill it with a plausible-looking value.
- Components live in `src/components/home/`, `src/components/draft/`, or `src/components/ui/` (shared primitives) — put a new one where its scope matches, not in a new top-level folder.
