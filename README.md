# Unhaul
A Chrome extension that helps users reconsider impulse purchases across categories:
stationery, home décor, toys, electronics, clothing and more.

## Status (2026-11-10, submission build)
MVP features FR-01 to FR-17 are implemented; see `docs/requirements.md` for each one's status
and what is verified. AI refinement runs only when the proxy is deployed and `PROXY_URL` /
`EXTENSION_TOKEN` are set at build time; otherwise the keyword fallback is used and the panel
still works.

## Install (judges)
1. Download `unhaul-*-chrome.zip` from the latest GitHub Release and unzip it.
2. Open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the unzipped folder.
3. The consent page opens. Click **Agree**, then **Load sample items** and quick-add one or two of your own.
4. Open a product page on a supported store, for example
   https://outfitters.com.pk/products/f0283-113, or any product on the stores listed below.
5. Click Add to cart. The store adds it as normal and the Unhaul panel opens. Choose **Save for later**.
6. Open the extension's options page to see the cooling-off list, countdown, Skip and Purchased.

## Supported stores
The single list is `extension/src/store/stores.ts` (it feeds host_permissions, the content
script matches and the product reader; never `<all_urls>`). Each store passed
`npm run stores:check` on 2026-11-10: Daraz, Stationers.pk, The Stationery Company, Zubaida's,
Rung, The School Store, Saleemi Book Depot, Toy Company, Toynix, Odeez, Baby Bazar,
Chase Value, Design Your Own, Blingspot, SOZ, Nishat Linen, Bonanza Satrangi, Cross Stitch,
Junaid Jamshed, Outfitters and Zellbury.

Store checks (run in `extension/`):
- `npm run stores:check` vets candidate stores live (bot blocks, login walls, robots.txt, product data, reader).
- `npm run fixtures:auto` saves product pages from the listed stores into `tests/fixtures/`.
- `npm run fixtures:check` builds and loads the extension in Chromium, serves each fixture at its
  real URL offline, and checks permissions, content-script injection and the reader.
  First time only: `npx playwright install chromium`.

## Development
Use the existing checkout; no extra worktree is needed. Node.js 22.12+ recommended.

```sh
cd extension
npm ci
npm run dev
# Manually load .output/chrome-mv3-dev in your Unhaul test profile.
# In another terminal, or after stopping dev:
npm run typecheck
npm test
npm run build
npm run zip
```

In managed environments with a read-only home directory, pass
`--cache /workspace/.npm-cache` to `npm ci`. For Wrangler, use
`XDG_CONFIG_HOME=/workspace/.unhaul-config WRANGLER_SEND_METRICS=false`
before its npm commands. These paths are outside the checkout.

Load `extension/.output/chrome-mv3` through Chrome → Extensions → Developer mode
→ Load unpacked after a production build. Open the extension's options page to
agree to the consent screen, then load fictional sample items or delete local data. See `proxy/README.md` for the worker.

## MVP scope
One verified shopping website with multiple categories; My Items; product extraction;
matching; a reflection panel; Save for later; a persistent cooling-off list.
Checkout is never blocked. Saving must not change the merchant's cart.
Keep owned items and visit history local. If AI is enabled later, disclose the public
product information transmitted to the proxy/provider.

## Ownership
- A: store adapters, content script, badge, panel, product fixtures.
- B: shared contracts, classification, AI proxy, matching, labelled evaluation.
- C: storage, consent/options page, cooling-off list, packaging and documentation.

See `docs/phase-2-handoff.md` for the PING/PONG walkthrough and A/B handoff.
See `docs/requirements.md` for implementation status and `SUBMISSION.md` for handoff.

## Planned proxy settings
Copy the root `.env.example` to `.env` when needed. `PROXY_URL` and `EXTENSION_TOKEN`
are reserved for later integration and are not read or bundled by this phase.
An extension-distributed token cannot be treated as a durable secret.

## Storage development
All active extension storage access belongs to the background repository. UI/content
uses `extension/src/storage/client.ts`; do not import repo.ts into an entrypoint
other than background. See docs/design.md for validation, legacy migration,
full-snapshot setter semantics and delete-all behavior.

## Fictional sample items
The demo includes ten records (`sample-01` through `sample-10`), two each for
stationery, home décor, toys/games, electronics, and clothing/accessories. Existing
taxonomy IDs use underscores. Pen sets use `pen`, decorative lights use `lamp`,
backpacks use `bag`, and caps use the additive `cap` type.

The journal/headphones samples support keyword/type matching demonstrations;
unrepresented types such as mugs support no-match demonstrations. These are
illustrative examples, not verified store fixtures: real-fixture alignment is pending.

Older installs may still contain `sample-journal`, `sample-vase`,
`sample-headphones` and `sample-puzzle`. Loading the new set preserves these and
may leave 14 records, including semantically similar old/new samples. No automatic
migration or deletion is performed in this sample-data task. The existing Delete
all data action removes all Unhaul data if a fresh demo is wanted; it also removes
consent and user-created records, so it is not a selective sample reset.

## Classification and matching (Phase 6)
PRODUCT_SEEN returns basic keyword analysis immediately. REFINE_PRODUCT uses its
analysisId for optional AI refinement. The Phase 7 badge/panel uses
`extension/src/classify/client.ts` to publish basic results first, then current AI
results, discarding replies after navigation/variant changes or consent revocation.
Phase 7 connects this helper to the structured reader and reflection UI.

Matching returns at most three explained same-type examples and the full match
count, excluding known conflicting purposes and broad-category-only similarity.
AI results use versioned product/variant cache keys and expire after 24 hours;
timeouts/offline/invalid replies use uncached keyword fallback so later requests
can retry. The background owns all analysis/cache operations and enforces consent.

See proxy/README.md for the server-side key, fixed model, exact origin/CDN allowlists,
rate limiting and PROXY_URL build setup. No live AI/deployment/accuracy result is
claimed. Incoming store fixtures are retained, but they do not establish live Daraz integration.

## Reflection UI (Phase 7)
After consent, recognized Daraz product pages show a small badge. Click it manually
or interact with Add to cart to open a nonmodal reflection panel. Continue shopping,
the dismiss button, or Escape closes it. Merchant clicks/submits are not cancelled
or modified. The panel displays current structured title/price, explained matches
and one rule-selected question. Missing price/currency is shown as unavailable.

Save for later offers 24 hours, 3 days or 7 days. Success appears only after the
background acknowledges persistence. It does not reserve stock, lock prices or
change the merchant cart. Open extension options to view the cooling-off list.

Automatic opening is limited once per product per actual tab session. Background
storage.session markers survive document reloads and worker suspension, are shared
across frames in a tab, and clear on tab close, browser restart, extension reload/update or Delete all data.
Variants of the same product share the limit; manual opening remains available.
After 500 distinct products in one tab, further automatic opening is denied.

The minimal structured reader uses Product JSON-LD or product Open Graph metadata;
no guessed merchant DOM selectors are used. It rejects contradictory canonical URLs
and waits for metadata changes on path navigation. Variant prices require matching
SKU offers; otherwise the price stays unavailable. Existing recorded history can
select the repeat-visit prompt (prior visit 30 minutes–30 days old). Visits are recorded
locally after each product analysis, once per product per 30 minutes, kept 30 days. Unknown/unrecognized pages show no shopping UI.

A synthetic ordinary-Chromium smoke check passed; this is not a live Daraz or native
extension-installation check. Incoming retailer fixtures are retained; they have not been validated for the active Daraz integration. See testing.md
and the repeatable harness commands below:

```sh
cd extension
./node_modules/.bin/esbuild scripts/reflection-smoke-harness.ts --bundle --format=iife --global-name=UnhaulHarness --outfile=/tmp/unhaul-reflection-harness.js
node scripts/reflection-smoke.mjs
```

The harness injects fake analysis/claims into intercepted synthetic pages only. It
is not an extension entrypoint and is not bundled in the production extension.

## Cooling-off list (Phase 8)
Use Save for later in the reflection panel, select 24 hours, 3 days or 7 days, and
wait for the save confirmation. Options → Saved for later shows the saved snapshot,
saved time, deadline and live remaining time/Ready. Skip and Purchased record your
own decision; Purchased is not automatic purchase verification or an owned-item add.

Active duplicates (including Ready items) are identified by store + product ID +
variant ID and preserve their original snapshot/deadline. Saving a decided product
again appends a new record with a fresh ID; its earlier decision stays in history.
Legacy deadline-only records and product-ID record IDs are read without rewriting.
New records store reconsiderAt and the compatibility deadline field identically.

Ready is calculated from the absolute timestamp and the device clock whenever the
view opens/focuses/becomes visible, and every second while visible. Clock changes
can affect the displayed time; this is not tamper-proof timing. No alarms or browser
notifications were added. Delete all data clears saved records and consent, and
open lists react to changes without recreating deleted data.

Automated persistence/module-reload checks and a synthetic ordinary-Chromium UI flow
passed. Native extension save/restart acceptance remains unverified because the
managed browser blocks extensions. No live merchant purchase or provider call ran.

## Concurrent incoming work
The Phase 8 merge retained new fixture files and their saver script. Conflicting
source drafts from the incoming branch contained unresolved merge markers and an
alternate notification/budget UI; exact copies are preserved under
`docs/merge-preservation/` for separate integration. They were not activated in this
storage/save-flow task, and existing consent/storage contracts remain in use.
