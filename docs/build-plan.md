# Unhaul: scope and build prompt

Nov 10, 2026. Living copy: https://claude.ai/artifact/EAen6sbEBpnCe4aN1M4ZzH

## Project scope

Unhaul is a Chrome MV3 extension that gives shoppers a voluntary pause before an impulse buy on a fixed list of stores, for any product type. It is due as a final commit hash at 3:00 PM PKT today. `context.md` in the repo root stays the source of truth; this section is the short version.

**What it does:** on a supported store's product page it reads the product, classifies it with AI (keyword fallback), and shows a badge if you already own something similar. On Add to cart, the store adds the item as normal and a panel opens with up to 3 owned matches, a reason, one reflection question, and Save for later (24 h, 3 d, 7 d) or Continue shopping. Saved items sit on a cooling-off list with a countdown that survives a Chrome restart, then show Ready with Skip or Purchased.

**Users:** students and young adults in Pakistan shopping on a laptop on a budget; and the judge, who must install and finish the demo on their own browser in under 5 minutes.

| In scope (Must) | Not building |
| --- | --- |
| Consent screen naming the stores; nothing runs before consent | Blocking checkout, preventDefault on store buttons, editing the store cart |
| One generic reader: JSON-LD, then Open Graph, then Shopify `.js` | Per-store reader code, `<all_urls>` |
| SPA navigation watch, deduplicated visit log (30 min) | Automatic purchase detection |
| Sample items, quick-add, list, delete all data | Accounts, cloud sync, photo uploads, mobile, other browsers |
| AI classify via Worker proxy, 3 s timeout, keyword fallback, cache per product | AI chatbot, reading bank or salary data |
| Matching by item type first, 4 rule-based questions | Notifications, budget, insights (deferred) |
| Save for later, cooling-off list, Skip and Purchased | Chrome Web Store listing (ship as Release ZIP) |

**Why AI is justified:** store titles are messy ("Aesthetic Vintage Kraft Diary 200 Pages with Lock"), so keyword rules miss most items and can't tell a diary and a journal serve the same purpose. The proof is a ~40-product hand-labelled set with AI vs keyword accuracy and latency reported in `docs/testing.md` (target: AI item-type accuracy at least 80% and 15 points above keywords). Only public product info (title, category text, image URL) goes to the proxy.

**Stores (decision needed):** three lists disagree. `context.md` says Daraz, Nishat Linen, Stationers.pk, Izhar Shop, SOZ. The committed fixtures are Outfitters, Bonanza Satrangi, Junaid Jamshed, Beechtree, Zellbury and Crossstitch, all clothing. Earlier planning also named Blingspot and Zero Lifecycle. The build prompt below defaults to the `context.md` five (they cover stationery, decor and clothing); swap the list in one place if the team chose otherwise.

## Current status

Phases 1 to 4 are done (Phase 4 is in PR #3, still open) and most of 5 to 8 is on main; Phases 9 and 10 have not started.

| Area | State | Gap to close |
| --- | --- | --- |
| Store list | Only Daraz in `wxt.config.ts` and `content.ts` | Add the chosen 5 domains to host_permissions, content matches, consent text |
| Visits (FR-05) | Not recorded | `recordVisit` with 30 min dedupe on PRODUCT_SEEN |
| SPA navigation (FR-04) | Not watched | Wrap pushState, listen to popstate, re-read product |
| ADD_TO_CART_CLICKED | Returns NOT_IMPLEMENTED (`background.ts:94`) | Return OK, log the click, never block |
| Fixtures and tests | 6 clothing fixtures, README says none captured | Fixture tests for the reader; README table of sources |
| AI accuracy proof | `tests/labels.json` has 4 items | ~40 labels and a script reporting AI vs keyword accuracy and latency |
| Proxy | Code in `proxy/`, not deployed | `wrangler deploy`, secret, PROXY_URL in build |
| Docs drift | design.md Daraz-only; storage keys in context.md vs code | Align docs with code |
| Phase 9 integration | Not started | Build, load unpacked, run the demo story once |
| Phase 10 release | Not started | README, docs, SUBMISSION.md, `wxt zip`, GitHub Release |

## Build prompt (one person, everything)

Paste this into Claude Code from the repo root on a fresh branch off main. It keeps the work in priority order so whatever is done by 2:00 PM is shippable.

```text
You are finishing Unhaul, a Chrome MV3 extension (WXT + TypeScript, chrome.storage.local, Vitest, Cloudflare Worker proxy at proxy/). Read context.md first; it is the source of truth. Deadline is 3:00 PM PKT today, so work in the order below, commit after each step, and stop polishing anything once it works.

Hard rules: never block checkout, never call preventDefault on store buttons, never use <all_urls>, never send owned items or visits to the proxy, never commit keys or tokens, no force-pushes. Do not rename fields in src/shared/; adding optional fields is fine. Log each meaningful AI use in docs/ai-usage-log.md. Run `npm run typecheck` in extension/ after each step; run only the tests you touch, not the whole suite.

Supported stores (edit this line if the team picked others): Daraz (daraz.pk), Nishat Linen (nishatlinen.com), Stationers.pk, Izhar Shop, SOZ. Look up each store's real domain and use https://<domain>/* patterns.

1. Stores: put the five domains in one exported constant, use it for host_permissions in wxt.config.ts, content script matches in entrypoints/content.ts, and the store names on the consent screen. Keep the proxy host entry.
2. Add to cart: in entrypoints/background.ts replace the NOT_IMPLEMENTED branch for ADD_TO_CART_CLICKED with a handler that keeps the consent work scope, records the click, and replies { type: 'OK' }. Confirm the content script listener is capture-phase and never blocks the click.
3. Visits: on PRODUCT_SEEN call recordVisit so the same productId within 30 minutes counts once; use repeat visits to pick the "What need would this purchase meet?" question per context.md section 8.
4. SPA navigation: in the content script wrap history.pushState and listen to popstate; on URL change wait for the new product's JSON-LD or Shopify data, re-read the product, and send PRODUCT_SEEN again. Panel auto-opens at most once per product per session.
5. Fixtures: write a Vitest test that runs the product reader over each file in extension/tests/fixtures/ and checks title, price, currency, image and productId are read (price null if absent, never guessed). Fill tests/fixtures/README.md with a table: file, store, category, data source (JSON-LD, OG, Shopify .js).
6. AI proof: grow extension/tests/labels.json to about 40 hand-labelled products across all six categories (made-up or public titles, values only from lists.ts). Add scripts/accuracy.mjs that classifies each with the keyword rules and with the proxy (if PROXY_URL is set), and prints item-type accuracy for both plus median and slowest AI latency. Write the measured numbers into docs/testing.md; if AI misses the 80% target, say so honestly.
7. Proxy: make sure proxy/ deploys with `npx wrangler deploy`, the API key is set with `wrangler secret put`, the extension token is checked, bodies over 2 KB are rejected and nothing is logged. Write the steps in proxy/README.md. Do not deploy yourself; leave a checklist for a teammate.
8. Docs: update docs/design.md (store list, data flow, storage keys exactly as in src/storage/keys.ts), fix the storage key names in context.md to match code, and add a decision-log line for the store list.
9. Integration: `npm run build`, then list the exact manual demo steps from context.md section 3 in docs/testing.md with a pass or unverified column. Do not mark anything passed that you did not see.
10. Release: fill README.md from se-max-template-main (what it does, judge quick start in under 5 minutes, install from Release ZIP, run locally, env var names only, known limitations, team), fill SUBMISSION.md and docs/judge-checks.md, make sure .env.example lists PROXY_URL and EXTENSION_TOKEN with no values, then run `npx wxt zip` and tell me the ZIP path so I can attach it to a GitHub Release.

If you fall behind, cut in this order: visual polish, the repeat-visit question, the panel opening limit. Never cut save for later, the AI fallback, the accuracy report or the docs. At the end, give me a short list of what is implemented, deferred and unverified.
```

## Split prompts (three people in parallel)

To work in parallel, each teammate pastes the build prompt above but replaces the numbered list with their own steps below. The split follows the ownership table in `context.md` so nobody edits the same files. Merge to main through PRs at least hourly; C merges last and cuts the ZIP.

| Who | Branch | Steps from the build prompt | Files they touch |
| --- | --- | --- | --- |
| A (aish) | a-store | 1 Stores, 2 Add to cart, 3 Visits, 4 SPA navigation, 5 Fixtures | `wxt.config.ts`, `entrypoints/content.ts`, `entrypoints/background.ts`, `src/store/`, `tests/fixtures/` |
| B | b-brain | 6 AI proof, 7 Proxy, 8 design.md and context.md | `tests/labels.json`, `scripts/accuracy.mjs`, `proxy/`, `docs/design.md`, `docs/testing.md` (accuracy part) |
| C | c-app | Consent store names (from 1), 9 Integration, 10 Release | consent UI, `README.md`, `SUBMISSION.md`, `docs/judge-checks.md`, `docs/requirements.md`, `.env.example`, Release ZIP |

One line to add at the top of each split prompt: "You only own the files listed for your role; if a change needs another role's file, write it down for them instead of editing it."

**Open question:** confirm the final five stores before A starts step 1, since the consent text, fixtures and README links all depend on it.
