# CLAUDE.md — Renowned

## Sales-forward redesign (in progress)

A storefront + admin redesign is underway on branch `redesign/sales-forward`,
gated behind `?redesign=1`. Full spec, page-by-page plan, and the live progress
checklist are in [`REDESIGN.md`](REDESIGN.md). Read it before doing redesign work.

Key conventions:
- Redesign styles go in `src/redesign.css`, scoped under `[data-redesign="1"]`.
  **Never edit `index.css` for redesign work** — the flag must flip old/new cleanly.
- The flag is set on `<html>` by `src/App.jsx`; `?redesign=1` on (sticky via
  localStorage), `?redesign=0` off.
- Local dev with real art: seed `runtime/content-store.json` from
  `curl https://renownedcomic.com/api/bootstrap` and proxy `/api/assets` to prod
  in `vite.config.js`. Real art lives at the public `/api/assets/<id>` endpoint.

## Progress tracking — STANDING RULE

`REDESIGN.md` section 11 is the live checklist and the single source of truth for
what's done.

**Whenever you complete AND verify a checklist item, scratch it off in the same
change set that finishes the work** — do not batch it for later:
- Flip its `- [ ]` to `- [x]`.
- Append a short parenthetical: `(YYYY-MM-DD, where it landed)`, e.g.
  `(2026-07-14, src/redesign.css)`.
- If you finished something that isn't on the list, add it as a new `- [x]` item
  under the right phase.
- "Verified" means observed working (computed styles, a passing check, or the
  user confirming in-browser) — not just written.

Keep the checklist honest: only `[x]` what is actually done and verified.
