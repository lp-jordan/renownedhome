# Renowned — Sales-Forward Redesign Spec

A self-contained brief for the storefront + admin rebuild. Written so a fresh
session (or teammate) can pick up without prior conversation context.

---

## 1. What Renowned is

An indie comic imprint storefront (brand: "Renowned" / "Storyhat Comics") — a
supernatural detective mystery set in 1920s Denver. It sells comic issues and
runs a small reader community.

**Stack:** React 18 + Vite + React Router (SPA) · Express API (`server.js`) ·
Postgres in prod / local runtime-JSON store in dev · S3 for assets · Stripe
(hosted checkout) · Resend (email). Single big stylesheet `src/index.css`
(~8k lines), noir dark theme.

**Current commerce model (the thing we're improving):**
- Issues sell in **digital / physical / external** formats.
- Checkout is **one issue + one format at a time**, via Stripe **hosted redirect**.
- **No cart. No customer accounts. No subscription.**
- Digital fulfillment = emailed **access tokens** (`/a/:token`, `/order/:token`,
  `/share/:token`) — no persistent library.
- Community = letters-to-the-editor (`/letters`) + photo correspondence
  (`/correspondence`); featured letters surface on the home page.

**Current public routes:** `/` · `/shop` (was `/buy`) · `/cart` · `/library` ·
`/meet` (+`/connect`) · `/issue-1|2|3` · `/one-shot` · `/letters` ·
`/correspondence` · delivery/token routes · `/checkout/return`.

**Current admin tabs** (flat, organized by internal mechanism): Orders ·
Delivery · Share Links · Pages · Shop · Letters · Assets · Redirects · Settings.

---

## 2. The core thesis

Today commerce is a **side panel, not the spine**. The home page opens with a
splash animation and three co-equal panels (Buy / Meet / Letters); buying is one
of three choices, takes multiple clicks, and every issue is a separate redirect.

**The redesign moves buying and reading to the spine**, keeping the noir brand
craft. Five commerce primitives the current build lacks (all standard in the
category — DSTLRY, ComiXology, Substack Comics, DTC Shopify):

1. **Free first issue** as top-of-funnel → email capture → nurture.
2. **Cart + bundles** ("get the complete run" in one checkout).
3. **Subscription / all-access** (biggest LTV lever for serialized fiction).
4. **Express checkout** (Apple Pay / Link) surfaced early.
5. **Magic-link customer library** (generalize the existing token infra).

---

## 3. Decisions locked in

- **Sequencing: hybrid** — build a shared design system first and apply it
  site-wide, *then* do per-page commerce depth in **funnel order (home → in)**.
- **Accent: Ember Noir `#E1502A`** for commerce CTAs (Buy, Add to cart,
  Checkout). **Brass `#C9A15B`** reserved for membership/all-access.
- **Feature flag:** all redesign work is gated behind `?redesign=1` so the
  current site stays shippable and you can A/B compare.
- **Branch:** `redesign/sales-forward`.

---

## 4. Local dev setup (with REAL art, no secrets)

The `defaultSiteData.js` seed ships **stale/dead art URLs** (old WordPress
`renownedcomic.com/wp-content/...` paths that now return HTML). The real art is
served by the app's own **public** `/api/assets/<id>` endpoint (S3-backed).

To run locally with real content + art:
1. API uses a local runtime-JSON store when `DATABASE_URL` is unset. Seed it by
   merging production data: `curl https://renownedcomic.com/api/bootstrap` into
   `runtime/content-store.json`, keeping the local `users` (dev admin).
2. Add a **Vite dev proxy** `"/api/assets" → https://renownedcomic.com` (before
   the `"/api" → localhost:3001` rule) so real art bytes load. All other API
   calls stay local/writable — no prod-DB risk.

Run: `node --env-file=.env.local server.js` (API :3001) + `npx vite` (:5173).
Dev admin login: `admin` / `renownedhome-dev`. No DB/Stripe/S3 keys needed for
design work; **Stripe TEST keys** only needed to exercise real checkout.

Side-by-side second stack (e.g. while another session holds the default
ports): `PORT=3002 node server.js` + the `dev-alt` config in
`.claude/launch.json` (vite on :5174 with `API_PORT=3002`, which
`vite.config.js` reads for the `/api` proxy target). Both port pairs are dev
trusted origins. Orders/library state in file mode lives in
`runtime/commerce-store.json` (gitignored alongside the content store); seed a
fake order with `FileOrdersStore.insertOrder` to exercise the library.

---

## 5. Phase 0 — Design system (DONE, behind flag)

**Mechanism:** `App.jsx` reads `?redesign=1` and sets `data-redesign="1"` on
`<html>` (sticky via `localStorage`; `?redesign=0` clears). New styles live in
`src/redesign.css` (imported by `main.jsx`), everything scoped under
`[data-redesign="1"]`. **`index.css` is never touched** — the flag flips old/new
cleanly.

**Delivered:**
- **Token layer:** `--ember`, `--ember-strong/deep`, `--ember-glow`, `--brass`,
  semantic (`--price/success/danger`), and type / space / radius / elevation
  scales.
- **Buttons:** primary → ember fill, white text, warm glow, 8px radius.
- **Buy box:** the Buy CTA (was a quiet secondary) → ember; buy card gets an
  ember edge. This is the key move — buying now visually out-ranks everything.
- **Eyebrows:** section kickers / issue eyebrows → brass.
- **Form fields:** ember focus ring + glow, tokenized radius.
- **Breadcrumb / footer:** brass current crumb, ember link hovers, footer hairline.
- **Cards:** unified radius; brass edge on featured letters.
- **`/system` reference route** (`src/components/SystemPage.jsx`): color, type,
  buttons, buy box, with an ON/OFF toggle.

**Deferred to the depth phases (do with eyes-on):** hero structural rebuild and
applying the type scale to existing headings — these are the most visual and
belong to the home-page work anyway.

**Verification note:** verify via computed styles / parsed CSS rules (screenshots
were unreliable in the setup session; the user's own browser is the visual check).

---

## 6. Page-by-page plan (funnel order)

Each Buy CTA keeps the **current single-item Stripe redirect** until the Cart
phase, then upgrades to add-to-cart. Every page ships working as we go.

### Phase 1 — Home `/`
**Current:** splash animation → three co-equal panels (Buy carousel / Meet /
Letters) → featured letters. Commerce is one of three choices, below the fold.
**Target — lead with the product:**
- Cinematic hero of the **current/flagship issue** (cover art, one-line hook,
  price) with a primary **"Read Issue #1 Free"** + secondary **"Buy the Run."**
- **Sticky mini buy-bar** on scroll (cover thumb + price + Buy).
- **The run as a horizontal shelf** with prices (and owned/read states once the
  library exists) — replaces the single-issue Buy carousel.
- **Featured letters** reframed as social-proof testimonials.
- Splash demoted to an optional first-visit flourish.
**Mechanic:** hero conversion + free-issue funnel entry.

### Phase 2 — Shop `/buy`
**Current:** product grid; each issue shows separate Digital/Physical buttons.
**Target:**
- Per-card **format toggle** (Digital/Physical) that updates price inline
  instead of two buttons; **Add to cart** affordance.
- Persistent **"Complete Run — save X%" bundle** tile as the first item.
- Sort/filter only if the catalog grows.
**Mechanic:** bundle economics + basket-building.

### Phase 3 — Issue detail `/issue-N` + reader
**Current:** hero (cover + synopsis), credits card, a buy card lower down, gallery,
and a preview-only reader overlay. The hero's primary button is "Open preview"
(the reader), so the reader — not Buy — reads as primary.
**Target:**
- **Single primary CTA = Buy** (ember). Demote the reader button to secondary/ghost.
- **Sticky buy box** (right rail desktop / fixed bottom bar mobile): format
  selector, price, **express button above the fold**, then Add to cart.
- **"Read free / preview N pages"** clearly labeled as the funnel CTA.
- Credits / synopsis / gallery move **below** the buy box.
- **Cross-sell** at the bottom: "next in the run" + the bundle.
- **Reader paywall:** on the last free page, an in-reader **"Keep reading —
  unlock the full issue"** card with the express-buy button right there; soft
  email-gate after page 1–2 of the free issue.
- **Issue #1 free** end-to-end.
**Mechanic:** express checkout + preview-to-purchase + cross-sell + email capture.

### Phase 4 — Cart + checkout + return
**Current:** no cart; `/checkout/return` just confirms.
**Target:**
- **NEW Cart `/cart` + slide-out drawer** — enables bundles, mixed
  digital+physical, quantity, one checkout. Retrofit Home/Shop/Issue CTAs to
  add-to-cart here.
- **Checkout:** keep Stripe hosted; ensure **Link / Apple Pay / Google Pay**
  enabled and express-first; pass the whole cart, not one line item.
- **`/checkout/return` becomes an onboarding + upsell moment:** "Your issue is in
  your library" + immediate **Read now** deep-link, magic-link setup, and a
  **"Complete the run — save X%"** post-purchase upsell.
**Mechanic:** basket + AOV + highest-converting upsell slot.

### Phase 5 — Library `/library` (NEW)
**Current:** ownership exists only as emailed token links (`/a/:token`, etc.).
**Target:** magic-link, **no-password** email-keyed library. Returning readers
see everything they own, read in-browser, re-download, and track the run. Keep
the existing token routes as entry points that resolve **into** the library.
**Mechanic:** retention / repeat purchase.

### Also refreshed (brand pages, demoted from the commerce path)
- **Meet the team `/meet`** — keep; fold the Substack "Headlines" newsletter into
  a site-wide footer email capture.
- **Letters `/letters` + Correspondence `/correspondence`** — retention/UGC.
  Featured letters feed home social proof; gate submissions behind "readers of
  Issue N."

---

## 7. Phase 7 — Admin backend

Today: flat tabs by internal mechanism (Orders / Delivery / Share Links are three
tabs for "who got what"). Reorganize around the **operator's daily questions**:

1. **Dashboard** *(new default)* — revenue this week/month, units by issue,
   free-funnel conversion, physical orders needing action.
2. **Orders** — merge **Orders + Delivery + Share Links** into one fulfillment
   view (Digital / Physical / Shared); one customer, one timeline.
3. **Products** (was Shop) — issues + **bundles** as first-class SKUs.
4. **Customers** *(new)* — email-keyed, ties into the library: owns / LTV.
5. **Content** — collapse **Pages + Letters + Assets + Redirects** under one area.
6. **Settings** — as-is + payment/express config.

---

## 8. Cross-cutting technical work

- **Express checkout:** enable Link/Apple Pay/Google Pay on Stripe; surface early.
- **Cart:** client cart state + a checkout session that accepts multiple line items.
- **Bundles:** a "complete run" SKU (Stripe price) with a discount vs individual.
- **Magic-link auth:** email-keyed, passwordless; generalize existing delivery
  tokens into durable per-customer access.
- **Email capture:** free-issue gate + newsletter; wire to Resend / Substack.

---

## 9. Technical conventions & file map

- **Flag:** `data-redesign="1"` on `<html>`; set in `src/App.jsx`; sticky via
  `localStorage`. `?redesign=1` on / `?redesign=0` off.
- **Styles:** all redesign CSS in `src/redesign.css`, scoped under
  `[data-redesign="1"]`. Never edit `index.css` for redesign work.
- **Reference page:** `src/components/SystemPage.jsx` at route `/system`.
- **Public routes/components:** `src/components/PublicSite.jsx`.
- **Admin:** `src/components/AdminPage.jsx` (+ `Delivery*`, `ShareLinksAdmin`, etc.).
- **API:** `server.js` (checkout at `/api/checkout`, assets at `/api/assets/:id`,
  bootstrap at `/api/bootstrap`).
- **Tokens/data:** `src/content/defaultSiteData.js` (seed shape).

---

## 10. Known data / production issues

- **Production art is partially broken:** several fields (e.g. issue-2's catalog
  `coverImage`, some page hero backgrounds) still reference dead `wp-content`
  URLs. Real art is at `/api/assets/<id>`. Worth a separate production fix.
- **issue-3** has no cover/art in prod (unreleased).
- These are reflected in the seeded local store; a local patch points issue-2's
  cover at its featured `/api/assets` id.

---

## 11. Progress checklist  ← single source of truth; scratch items off as done

Legend: `[x]` done & verified · `[ ]` not started. When an item lands, flip it to
`[x]` and append `(YYYY-MM-DD, where it landed)`. See the tracking rule in `CLAUDE.md`.

Build order: Phase 0 → 1 Home → 2 Shop → 3 Issue+reader → 4 Cart/checkout/return →
5 Library → 7 Admin. (Cart lands at Phase 4; earlier CTAs use the
existing single-item Stripe redirect until then. Phase 6 — Subscribe — was
descoped by user decision on 2026-07-15: not pursuing a subscription model
at this time.)

### Phase 0 — Design system (behind `?redesign=1`)
- [x] Token layer: ember/brass, type/space/radius/elevation/semantic (2026-07-14, src/redesign.css)
- [x] Ember primary buttons (2026-07-14, src/redesign.css)
- [x] Ember buy-box CTA + ember buy-card edge (2026-07-14, src/redesign.css)
- [x] Brass eyebrows (2026-07-14, src/redesign.css)
- [x] Form fields: ember focus ring + tokenized radius (2026-07-14, src/redesign.css)
- [x] Breadcrumb + footer accents (2026-07-14, src/redesign.css)
- [x] Cards: unified radius + brass featured edge (2026-07-14, src/redesign.css)
- [x] `/system` reference route (2026-07-14, src/components/SystemPage.jsx)
- [x] Hero structural refresh + type scale applied to existing headings (2026-07-15, subsumed by later phases — closing out retroactively, not new work). The hero rebuild happened as Phase 1's "Isolated hero + commerce carousel moved below it" (`.home-brand__title` uses `--fs-h1`, `.home-brand__subtitle` matches the hero subtitle treatment). The type scale tokens (`--fs-h1/h2/h3/eyebrow/lg/sm/body`) ended up applied broadly across every redesign-path component built in Phases 1–3 and 7 (shop cards, issue page, library, admin), not just headings in isolation — verified via `grep` for `var(--fs-` usage across src/redesign.css (30+ call sites spanning headings, eyebrows, and body copy).

### Phase 1 — Home `/` — CLOSED OUT (2026-07-14, by user decision)
- [x] Isolated hero + commerce carousel moved below it (2026-07-15, src/components/PublicSite.jsx `HomePage`/`HomeCarousel` + src/redesign.css `.home-lead`/`.home-brand`/`.home-carousel`). The hero (`.home-lead`) is now a standalone brand moment: full-bleed cinematic background (flagship cover art + scrim) behind a centered logo, the brand tagline ("A supernatural detective mystery set in 1920s Denver"), and a single ember **"Shop the Series"** CTA linking to `/buy` — no carousel inside it. The commerce carousel (eyebrow · Out Now/Coming Soon, 16:9 cover, description, ember Buy + "Explore the series", dot controls, auto-rotate/cross-fade/progress bar as before) now renders directly below the hero in `page-stack`, immediately above featured letters — its existing brass eyebrow line doubles as the section break, so no separate heading was added. Buy still reuses the single-item Stripe redirect; price renders live from Stripe in prod. Old three-panel Buy/Meet/Letters grid remains removed on this path; Meet/Letters still reachable via the flag-gated footer nav.
- [x] Featured letters reframed as social proof (2026-07-14, src/components/PublicSite.jsx `FeaturedLettersSection`): heading "Letters from Readers" **always shows** (even with zero letters), same admin-controlled `featured` flag + `LetterCard` markup as before, plus a "Write a Letter" CTA linking to `/letters`. No featured letters in the local seed to visually confirm card rendering, but the component is unchanged from the working prior implementation aside from the heading/CTA.
- [ ] Sticky mini buy-bar on scroll — descoped by user decision; the carousel is high enough on the page (no long scroll before the Buy button) that this wasn't pursued. Revisit if later phases add more scroll depth above the fold.
- [ ] The run as a horizontal shelf (with owned/read states once library exists) — superseded by the commerce carousel's dot-based issue switcher, which already lets visitors browse the run from below the hero. Revisit if/when per-issue owned/read states land with the library (Phase 5).
- [x] Splash demoted to optional first-visit flourish (2026-07-15, src/components/PublicSite.jsx `HomePage`): persistence switched from an in-memory module flag (replayed on every full reload) to a `localStorage` key (`renowned:homeSplashSeen`) set the moment the splash starts, so it plays once ever per browser, not once per page load. Applies to both the redesign and legacy home page (shared code above the `?redesign=1` branch). Verified via Vite HMR + served-module inspection (no chromium-cli/Playwright available in this environment); user confirmed the hero/carousel split looks correct on mobile.

### Phase 2 — Shop `/buy` → `/shop` — CLOSED OUT (2026-07-15, by user decision)
- [x] Portrait card grid + detail panel, superseding the original "toggle on the existing list card" plan (2026-07-15, src/components/PublicSite.jsx `ShopPage`/`ShopCard`/`ShopDetailPanel` + src/redesign.css `.shop-card-grid`/`.shop-card`/`.shop-panel`). The single-column list of large horizontal cards is replaced (redesign flag only) by a portrait grid — cover, title, simple price (e.g. "$8", trailing `.00` stripped) — where tapping a card opens a detail panel: right-rail slide-in on desktop, bottom sheet on mobile (matches the codebase's existing 700px breakpoint), with synopsis + the format toggle + Add to Cart. Basic modal semantics: `role="dialog" aria-modal="true"`, focus moves to the close button on open and returns to the triggering card on close, `Escape`/backdrop-click/close-button all dismiss it, background scroll locked while open, lightweight Tab focus trap. Legacy (`?redesign=0`) path is untouched.
- [x] Per-card format toggle with inline price (2026-07-14/15, `ShopFormatToggle`, reused as-is inside the new detail panel — this predates the card-grid pivot but landed as part of this phase). Still checks out via the existing single-item Stripe redirect; cart lands in Phase 4.
- [x] Add-to-cart affordance (2026-07-15, `ShopDetailPanel`/`ShopFormatToggle`'s "Add to Cart" button) — visual affordance only; still the single-item Stripe redirect under the hood, matching the plan that a real cart isn't built until Phase 4.
- [x] Bundle presented in the same grid, not a separate promo tile — per user decision (2026-07-15, `ShopCard`'s `shop-card--bundle` + `.shop-panel`'s bundle branch, src/redesign.css `.shop-card--bundle`). Brass border + soft glow (intensifies on hover/tap) + "Bundle" badge on the card; its panel shows "Coming soon" / disabled "Notify Me" — still not purchasable, no bundle Stripe price or cart until Phase 4.
- [x] Rename "Buy" → "Shop", including the URL (2026-07-15, not on the original list — user-requested; src/components/PublicSite.jsx route + all internal links, src/components/AdminPage.jsx, src/components/CheckoutReturnPage.jsx, server.js `safeCancelPath`, src/content/defaultSiteData.js). `/buy` now 301s to `/shop` via the existing CMS-driven, admin-editable redirect table (`server.js`'s redirect middleware) — verified directly against Express (curl showed `301` + `Location: /shop`); note the redirect only fires when Express itself serves the request (production, or hitting :3001 directly) — Vite's dev proxy on :5173 only proxies `/api*`, so `/buy` 200s to the SPA shell in local dev, which is a dev-tooling quirk, not a bug. **Production migration:** the live page's `slug` field lives in Postgres and isn't admin-editable (Pages editor is read-only for code-managed fields), so it needed a one-off update. **Done (2026-07-15)** — user ran it directly against prod via the Railway Postgres console (`content_store` is a JSONB `pages` array; `jsonb_set` rewrote `elem->>'slug'` from `/buy` to `/shop` in place). Verified: `SELECT elem->>'slug', elem->>'title' ... WHERE slug IN ('/buy','/shop')` returned exactly one row, `/shop | Buy`, no `/buy` row remaining.
- [x] Shop hero copy cleanup + subtitle (2026-07-15, src/content/defaultSiteData.js `page-buy` hero, src/components/PublicSite.jsx `ShopPage`). Removed stale pre-launch hero subtitle ("Store Coming Soon.") and "Follow Campaign" Kickstarter CTA, the "Shop the Series" intro heading, and the "Digital and physical checkout links..." footer note (redesign path only — legacy path unchanged) so the card grid sits right under the hero. Added a new hero subtitle, "Catch up on the story so far.", styled in the same Josefin Sans treatment as the live production home hero subtitle (`.hero__subtitle` in src/index.css) — also backported that font treatment to the redesign home hero's subtitle (src/redesign.css `.home-brand__subtitle`) for consistency between the two.

### Phase 3 — Issue `/issue-N` + reader — CLOSED OUT (2026-07-15, by user decision)
- [x] Single primary Buy CTA + sticky/express buy box (2026-07-15, src/components/PublicSite.jsx `IssuePage` + src/redesign.css `.issue-story--redesign`/`.issue-buybox`). Redesign path only: the hero's reader/preview button is now secondary/ghost ("Read Free" for issue-1, "Preview" for others — legacy path unchanged); Buy (reusing `ShopFormatToggle`, now used a third time) lives in a sticky buy box — right-rail on desktop (`position: sticky`), fixed bottom bar on mobile (`@media max-width: 700px`, mirrors the `.shop-panel` desktop/mobile split from Phase 2).
- [x] Credits/synopsis moved below/beside the buy box (2026-07-15, same component) — redesign path only; legacy layout untouched.
- [x] Gallery folded into the cover thumbnail (2026-07-15, not originally on the list, but directly requested): the standalone bottom gallery grid (`.issue-gallery-section`) is dropped on the redesign path — the single cover thumbnail (already clickable → opens the reader) is now the only entry point, since the reader already pages through every image once opened. Legacy path keeps the grid.
- [x] Cross-sell — next in the run + the bundle (2026-07-15, `IssueCrossSell` component, reuses the `.shop-card` visual language from Phase 2 as plain links since there's no in-page panel to open here).
- [x] In-reader paywall + soft email gate (2026-07-15, `IssueReaderOverlay`/`ReaderBuyGate`/`ReaderEmailGate`). **Key implementation decision:** rather than rebuilding the reader's zoom/perf/nav from scratch, the redesign-path reader now renders `InlinePdfReader` (`src/components/InlinePdfReader.jsx`) — previously only used by the post-purchase delivery reader — inside the existing modal shell (veil/title bar/close, unchanged). This gets zoom in/out/reset, fullscreen, wide-spread, swipe, and page preloading for free, addressing "optimize the reader" without new perf/zoom code. Preview boundaries are enforced by controlling which pages are handed to the reader (truncated array), not by modifying `InlinePdfReader` itself: non-free issues show a `previewPageLimit` (admin-editable per issue, default 5) then a buy-gate card; the free issue shows all pages up to a threshold (page 3) then an email-gate card that `POST`s to a new `/api/public/leads` endpoint and unlocks the rest of the session (soft gate — no verification/magic-link). Legacy path (`ComicReaderOverlay`) is fully untouched.
- [x] Free Issue #1 end-to-end (2026-07-15, by user decision: issue-1 is `isFree: true`). **Content note, not a code gap:** the reader currently only has each issue's existing preview/gallery art (~6-7 images); making issue #1 truly "full" requires uploading its complete page art via the existing admin Images panel (`IssueGalleryManager`) — the mechanism is correct regardless of how many pages exist today.
- [x] Shop → Issue connector (2026-07-15, not on the original list, user-requested): `ShopDetailPanel` (Phase 2) now links to the issue's own page — "Read Free" for issue-1, "More info" for every other issue.
- [x] New `leads` admin surface (2026-07-15, not on the original list): `server.js` `leads` collection (JSONB, same mechanism as `redirects`/`shareLinks`, no schema migration) + `POST /api/public/leads` + `DELETE /api/admin/leads/:id`, and an admin "Leads" tab (table: email/issue/date, delete only). **Production note:** new issue fields (`isFree`, `previewPageLimit`) and the `leads` collection won't retroactively exist on already-seeded prod data until either an admin edits an issue (the new fields are now in the Issue editor's Preview/Reader card) or a one-off backfill runs — the consuming code defaults defensively (`previewPageLimit ?? 5`, `leads || []`) so nothing breaks in the meantime.

### Phase 4 — Cart + checkout + return
- [x] Cart `/cart` + slide-out drawer (2026-07-15, src/components/Cart.jsx + src/redesign.css `.cart-*`). `CartProvider` (localStorage key `renowned:cart`, lines pruned against the live catalog), a cart button with count badge in the breadcrumb bar, a drawer (desktop right rail / mobile bottom sheet, mirroring `.shop-panel`, but z-index 80 so in-reader adds surface above the reader overlay), and a full `/cart` page. Verified in-browser: add / quantity / remove / persistence across full reload / empty state.
- [x] Retrofit Home/Shop/Issue CTAs to add-to-cart (2026-07-15, src/components/PublicSite.jsx). `HomeCarousel` Buy → "Add to Cart — price"; `ShopFormatToggle` (shop detail panel, issue buy box, reader buy gate — all three call sites) now adds to cart and opens the drawer instead of the single-item Stripe redirect. The bundle panel's CTA is now **"Add the Run to Cart"** — adds every currently-sellable issue (digital preferred) in one tap. **Still deferred: a true discounted complete-run SKU** needs a Stripe price created in the dashboard + an admin field to hold its ID; the run-add uses individual prices with no discount. Legacy (`?redesign=0`) path verified untouched (old panels, no cart UI).
- [x] Multi-line checkout session + express-checkout readiness (2026-07-15, server.js `/api/checkout`). Accepts `items: [{issueId, format, quantity}]` (quantity clamped 1–10, ≤20 lines) with back-compat for the legacy single-item body; collects shipping when any line is physical. Verified against a dummy Stripe key: validation errors (bad format / unknown issue / unsellable) and both request shapes assemble line_items and reach the Stripe API call. **Express wallets (Link / Apple Pay / Google Pay) are a Stripe Dashboard toggle** (Settings → Payment methods) — the session code doesn't restrict `payment_method_types`, so enabling them there is all that's needed; confirm with one TEST-mode checkout.
- [x] `/checkout/return` onboarding (Read now + magic-link) + post-purchase upsell (2026-07-15, src/components/CheckoutReturnPage.jsx). Redesign path: "It's in your library." + **Read Now** (order token deep link) + auto library claim from the paid Stripe session (silent; button falls back to "Set Up My Library" when claim isn't possible) + **Complete the Run** upsell (sellable issues not in this order, shop-card links); clears the cart once payment confirms. Legacy path byte-for-byte prior behavior (redirect to `/order/:token`). Verified locally with a stubbed paid-session lookup flowing through the real delivery + claim endpoints; a full Stripe TEST purchase (webhook → return) is the remaining prod-shaped pass.

### Phase 5 — Library `/library` (new)
- [x] Magic-link passwordless, email-keyed library (2026-07-15, server.js `/api/library/*` + src/lib/ordersStore.js + src/components/LibraryPage.jsx). `POST /api/library/request-link` (rate-limited 6/15min; emails via new `buildLibraryLinkEmail`; **dev without Resend returns the link as `devLink`**; production without Resend 503s) → single-use 30-minute token → `POST /api/library/claim` → 30-day httpOnly cookie session. `GET /api/library` returns owned digital issues deduped across orders (cover, 48h signed download URL when S3 is configured) + order history. Library page: signed-out email form, signed-in grid with **Read** (InlinePdfReader on the owned PDF, falling back to the issue's page images) and **Download**, sign-out. Verified end-to-end in-browser locally (request → devLink claim → grid → reader with real proxied art → sign out), including single-use token rejection on second claim. **Update (2026-07-15):** the "Your Library" eyebrow is left-aligned and only shows once the signed-in library has owned items; the signed-out copy now reads "Your issues, easy-peasy." with a shorter subtitle (src/components/LibraryPage.jsx + src/redesign.css `.library-shell .library-eyebrow`).
- [x] Existing token routes resolve into the library (2026-07-15). `/order/:token` (src/components/OrderDeliveryPage.jsx, redesign only) gets a "Save to My Library" banner → `POST /api/library/claim-order` (the emailed token proves inbox possession) → lands signed-in on `/library`; `/checkout/return` claims via `POST /api/library/claim-session` (paid Stripe session id). Both verified locally. `/a/:token` and `/share/:token` (legacy campaign delivery) left as-is — they're a different store with their own recipients; fold in later if wanted.
- [x] Orders store abstraction — orders now exist in local dev (2026-07-15, not on the original list; src/lib/ordersStore.js). `PgOrdersStore` (existing orders/order_items/order_deliveries/stripe_events tables + new `library_tokens`/`library_sessions`, auto-created on boot — no manual migration) and `FileOrdersStore` (runtime/commerce-store.json) behind one interface; webhook, `/api/checkout/session`, `/api/order-delivery`, `/api/admin/orders` all refactored onto it, so the whole checkout→delivery→library chain (and the admin Orders tab) now works without Postgres. Also fixed `/api/order-delivery` asset resolution when `shop.digitalAssetId` holds the `/api/assets/<id>` URL form (as prod data does) rather than a raw asset id — previously that lookup silently failed.

### Phase 7 — Admin
- [x] 6-group nav restructure: Dashboard / Orders (Orders + Delivery sub-tabs) / Products / Customers (Customers + Leads sub-tabs) / Content (Pages + Letters + Assets + Redirects sub-tabs) / Settings (2026-07-15, src/components/AdminPage.jsx). Subscriptions descoped by user decision (Phase 6 not built), so no MRR/churn or subscription-tier SKUs — scope trimmed accordingly from the original spec wording. Sidebar shows the 6 top-level groups; groups with sub-tabs render a secondary pill row (`admin-subnav`) at the top of the content pane.
- [x] Dashboard — real aggregation queries, not client-side rollups (2026-07-15, `getDashboardStats()` in src/lib/ordersStore.js for both `PgOrdersStore`/`FileOrdersStore` + `GET /api/admin/dashboard` in server.js + `DashboardAdmin` in src/components/AdminPage.jsx). Revenue this week/month (SQL `SUM` filtered by `date_trunc`, or JS date-range reduce in file mode), units sold by issue (grouped `order_items` count), free→paid conversion (leads count vs. distinct paying customer emails), physical orders needing action with an inline "Mark shipped" action. Verified in-browser against the local seeded store, including a synthetic physical order dropping off the list after marking shipped (confirmed via direct API call + dashboard reload, since this session's dev server had flaky HMR reconnects that interfered with a couple of live UI clicks).
- [x] Fulfillment status on orders (2026-07-15, src/lib/ordersStore.js + server.js). New `fulfillment_status` column/field (`ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT` in `PgRepository.init()`, auto-created on boot like the Phase 5 library tables — no manual migration), defaulted to `pending` for orders with a physical line item and `n/a` otherwise, set at `insertOrder()` time in both stores. `updateFulfillmentStatus(orderId, status)` on both stores + `PATCH /api/admin/orders/:id/fulfillment` (`requireTrustedOrigin, requireAdmin`).
- [x] Merge Orders + Share Links into one fulfillment view; Delivery kept as its own panel under the same "Orders" nav group rather than merged into one table, since the backer-campaign data model is too different to force together — per user's scoping decision going into this phase (2026-07-15, `OrdersAdmin` in src/components/AdminPage.jsx). No new backend endpoint for the merge — reuses `GET /api/admin/orders` + `GET /api/admin/share-links`, fetched client-side and rendered in one table with a Digital/Physical/Shared type badge, sorted by date. **Correction from the original plan:** the initial cut dropped ShareLinksAdmin's upload/edit/delete UI entirely (the plan only specified a read-merge into a table); restored it as a collapsible "Manage Share Links" `AccordionSection` below the merged table (reusing the existing `ShareLinksAdmin.jsx` untouched) so no functionality regressed. `DeliveryAdmin.jsx` renders unchanged as the "Delivery" sub-tab; smoke-tested in-browser.
- [x] Products — renamed from "Shop" to "Products" (label + header only; no internal changes to `IssuesWorkspace`/`IssueEditor`), plus a static "Bundle SKU: storefront placeholder only, not yet configurable here" note card, since building a real bundle SKU stays deferred per Phase 4's original scoping (2026-07-15, `IssuesWorkspace` in src/components/AdminPage.jsx). Verified in-browser: same issue editor, relabeled, note renders above the product list.
- [x] Customers — new email-keyed view: table (email / order count / LTV / last order) + click-through detail (order timeline + owned digital issues) (2026-07-15, `listCustomers()` in src/lib/ordersStore.js for both stores + `GET /api/admin/customers` / `GET /api/admin/customers/:email` in server.js + `CustomersAdmin`/`CustomerDetail` in src/components/AdminPage.jsx). Customer detail reuses `listOrdersByEmail()` plus a new shared `resolveOwnedIssuesForEmail(email)` helper extracted out of the `/api/library` handler (server.js), so owned-issue resolution can't drift between the public library and this admin view — verified the two return matching data for the same seeded email. `LeadsAdmin` moved under Customers as a sub-tab, unchanged internally; verified working.
- [x] Content group — Pages/Letters/Assets/Redirects collapsed under one "Content" nav entry as sub-tabs; zero internal changes to any of the four panels (2026-07-15, nav restructure in src/components/AdminPage.jsx). All four sub-tabs verified rendering and functioning in-browser.
- [x] Settings — unchanged, re-labeled as its own top-level group (2026-07-15, verified in-browser). Payment/express/subscription config not added, since subscriptions are descoped.

### Brand pages (demoted from commerce path)
**Scoped 2026-07-15.** None of `TeamPage` (Meet), `LettersPage`, `CorrespondencePage`,
or `SiteFooter` currently branch on `isRedesignOn()` at all — they render
identically on both paths today. This phase brings them under
`[data-redesign="1"]` (tokens/cards from Phase 0, same visual language as
Shop/Issue/Library), plus the footer capture. **By user decision: no
ownership/issue gate on Letters or Correspondence** — the original spec's
"gate submissions behind readers of Issue N" is dropped in favor of keeping
the one-page, no-email, pick-any-issue flow exactly as frictionless as it is
today. Correspondence stays fully ungated and untagged to an issue (it isn't
issue-specific in the data model and isn't being made so).

- [x] Site-wide footer email capture (2026-07-15, `SiteFooter` in
      src/components/PublicSite.jsx). Reuses the existing `POST /api/public/leads`
      endpoint from Phase 3, tagged `source: "footer"` so the admin Leads table
      can tell it apart from the reader gate.
- [x] Fold the Meet page's standalone "Headlines" Substack card into the
      footer capture (2026-07-15, src/components/PublicSite.jsx ~L1096-1128).
      Page-local card now reads from the footer capture copy; the Substack
      external link ("Subscribe on Substack") is kept as a secondary link, not
      dropped.
- [ ] Meet `/meet` visual refresh — descoped by user decision (2026-07-15):
      current look is fine as-is, not pursuing the Phase 0 restyle.
- [x] Letters `/letters` visual refresh under the flag — user confirmed done
      (2026-07-15). No new fields, no gate, per decision above.
- [x] Correspondence `/correspondence` visual refresh — user confirmed fine
      as-is (2026-07-15), no gate, no issue tagging.
