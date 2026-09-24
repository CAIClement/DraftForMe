# Current work

## feat/home-animations
Started: 2026-09-24
Spec: docs/superpowers/specs/2026-09-24-draftforme-home-animations-design.md
Plan: docs/superpowers/plans/2026-09-24-draftforme-home-animations.md

- Done: plan Tasks 1-7 (subagent-driven, then a whole-branch review). `npm run ci` green (367 tests). Draft components, engine, seed, ml untouched.
- Review fix: `.sheen` no longer sets `overflow: hidden`, which clipped the CTA button's focus ring.
- Browser check on `npm run dev`: hero animates, reveals play once on scroll, top score counts to its real value (86), bars fill; mobile 375px has no horizontal scroll and 4 diamonds; `/draft` bars unaffected; reduced-motion CSS rule present. Reduced motion itself not emulable in the preview pane: owner can confirm in Chrome DevTools (Rendering).
- Known, accepted: `CountUp` sets 0 on mount, but its card is hidden by `Reveal` at that point, so no visible flicker.
- Next: ship (merge or PR), owner's choice. Nothing pushed.

## feat/matchup-reviews
Started: 2026-09-24
Spec: docs/superpowers/specs/2026-09-24-draftforme-matchup-reviews-design.md
Plan: docs/superpowers/plans/2026-09-24-draftforme-matchup-reviews.md

- Done: plan Tasks 1-10 and 12 (subagent-driven, each task reviewed, then a whole-branch review and its fixes). `npm run ci` green (354 tests), `seed:check` clean, engine/seed/ml untouched. Spec updated to record what was built.
- Owner decisions taken on the way: open flat discussion; votes and reactions stay publicly readable (legal text says so).
- Task 11 done 2026-09-24: migration 0005 checked on a local Supabase (every rule holds), signed-out `/duel` page checked in the browser against it. Signed-in paths not run end to end (no local OAuth).
- Next: ship (merge or PR), owner's choice.
- Before production: try the signed-in paths once on a preview; set `SITE_INFO.contactEmail`; applying 0005 to production is the owner's call.
- Nothing pushed.

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
