# Unhaul
A Chrome extension that helps users reconsider impulse purchases across categories:
stationery, home décor, toys, electronics, clothing and more.

## Status
Development scaffold, not a completed MVP. Sample-item loading, deletion, keyword
classification, matching and installation consent onboarding exist. Structured product
reading and reflection UI are implemented for the existing Daraz scope; live store
verification is pending. Saving/timers remain to be built. AI refinement is implemented but disabled until the proxy is configured and deployed.
Daraz Pakistan is the Phase 2 target. Production host access is restricted to
`https://www.daraz.pk/*`, with content injection only on `/products/*`.
The content script reads products and mounts a reflection badge/panel only after
literal true consent. It stops on revocation and resumes after agreement in an
already-open supported tab. PING/PONG remains a diagnostic.
Live store extraction is not verified.
Automatic visit recording is not enabled; external AI calls are disabled without proxy configuration.

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
claimed. No real product fixtures have been added.

## Reflection UI (Phase 7)
After consent, recognized Daraz product pages show a small badge. Click it manually
or interact with Add to cart to open a nonmodal reflection panel. Continue shopping,
the dismiss button, or Escape closes it. Merchant clicks/submits are not cancelled
or modified. The panel displays current structured title/price, explained matches
and one rule-selected question. Missing price/currency is shown as unavailable.

Save for later is visibly disabled with an explanation: Phase 8 is unfinished.
No save confirmation, stock reservation, price guarantee or cart change is claimed.

Automatic opening is limited once per product per actual tab session. Background
storage.session markers survive document reloads and worker suspension, are shared
across frames in a tab, and clear on tab close, browser restart, extension reload/update or Delete all data.
Variants of the same product share the limit; manual opening remains available.
After 500 distinct products in one tab, further automatic opening is denied.

The minimal structured reader uses Product JSON-LD or product Open Graph metadata;
no guessed merchant DOM selectors are used. It rejects contradictory canonical URLs
and waits for metadata changes on path navigation. Variant prices require matching
SKU offers; otherwise the price stays unavailable. Existing recorded history can
select the repeat-visit prompt (prior visit 30 minutes–30 days old); this phase does
not add automatic visit recording. Unknown/unrecognized pages show no shopping UI.

A synthetic ordinary-Chromium smoke check passed; this is not a live Daraz or native
extension-installation check. Real store fixtures are still absent. See testing.md
and the repeatable harness commands below:

```sh
cd extension
./node_modules/.bin/esbuild scripts/reflection-smoke-harness.ts --bundle --format=iife --global-name=UnhaulHarness --outfile=/tmp/unhaul-reflection-harness.js
node scripts/reflection-smoke.mjs
```

The harness injects fake analysis/claims into intercepted synthetic pages only. It
is not an extension entrypoint and is not bundled in the production extension.
