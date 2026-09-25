# Current work

## feat/micro-animations
Started: 2026-09-24
Spec: docs/superpowers/specs/2026-09-24-draftforme-micro-animations-design.md
Plan: docs/superpowers/plans/2026-09-24-draftforme-micro-animations.md

- Done before: plan tasks (fade-in token, draft hover easing, slot hover state, marketing hovers and press feedback), 9 commits.
- 2026-09-25: branch was 64 commits behind main. Merged main in (22759f0); three conflicts (globals.css, draft-board.tsx, draft-slot.tsx), resolved by keeping main's markup and adding the branch's transitions and hover states on top.
- Comparison table rows now ease their hover colour too (the table landed on main after the spec).
- `npm run ci` green after the merge (395 tests).
- Browser check (npm run dev): /draft slots, role button and table rows carry a 0.2s colour transition, `.fade-in` loaded, no console error; home CTA eased, both `.sheen` present, no horizontal scroll.
- Next: ship (owner's choice). Nothing pushed.

## Shipped (main == origin/main at 2affd5e, 2026-09-25)
- feat/draft-comparison-table, feat/home-animations, feat/matchup-reviews: merged and pushed.
- Still open from matchup-reviews, before production: try the signed-in paths once on a preview; set `SITE_INFO.contactEmail`; applying migration 0005 to production is the owner's call.

## Stale branch
- wip/home-redesign: 1 commit ("redesign the home page into sections"), likely superseded by feat/home-animations. Check, then delete if so.

<!--
Format `/pause` writes and `/point` reads:

## <branch name>
Started: <date>
Spec: <path, if any>
Plan: <path, if any>

- What's done
- What's next
- Anything blocking
-->
