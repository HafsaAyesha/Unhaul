# Design
Content script → background messages → classifier/matcher/storage → page UI.
Options app manages consent, Home, My Items, Saved, Dashboard and Settings. The service worker must not
rely on in-memory state or long-running timers. Persist absolute deadlines.

Shared interfaces live in `extension/src/shared`. One adapter per verified store.
Prefer Product JSON-LD, then documented embedded data, then narrow DOM selectors.
Use Shadow DOM for injected UI. Observe merchant actions without cancelling them.

Only owned items are persisted by the current scaffold. Planned: saved snapshots,
30-day visits, classification caches and versioned settings. Add runtime validation
and schema migrations before expanding storage. Matching is type/category based;
shared category alone is insufficient. Unknown products must not produce matches.

Privacy: request narrow store access after selection; enforce consent before observing.
Never read payment/password fields. Keep owned items and visits local. Optional AI
sends public product information through a protected proxy; never embed provider keys.
The configured proxy calls OpenAI; without configuration it fails closed. Consent UI is implemented; live AI is unverified.

## Strict cooling-off lock

The cooling-off lock defaults on when its optional setting is absent. A matching waiting
saved product is held in the capture phase for click, submit and keyboard activation
until the deadline; unknown or failed checks fail open. The only early exit is the
options page, which records `endedEarlyAt` and presents the item as Ready to decide.
Content receives only the current product's lock result, never saved records.

## Background-owned storage
The active extension contracts remain in `extension/src/shared`; uploaded root-level
contract drafts are preserved but are not imported by the WXT extension.

`src/storage/keys.ts` defines settings, items, saved items, visits and classification
cache keys under `unhaul:`. Settings use schemaVersion 1 and consentGiven. Explicit
initialization on install/startup writes missing defaults without changing existing
consent. Ordinary reads return false-consent settings/empty collections without
writes, including after deletion. Invalid/unsupported records cause an error.

Only the background imports the repository. Options uses `storage/client.ts` and
validated STORAGE messages. The background validates sender identity, operation and
payload, keeps asynchronous response channels open, and returns serializable
success/error envelopes. Only the options page may manage/read private records;
content scripts can request settings. PING/PONG remains unchanged.

All repository operations share one background-owned promise queue, including
reads, initialization, migration, setters and deletion. Whole read-modify-write
operations are queued, not just writes. Rejected operations do not poison the queue.
Reads submitted after acknowledged mutations see their results. No nested queue
calls are used. Duplicate addItem IDs are rejected. deleteItem of an unknown ID is
a successful no-op without a write. Sample loading is atomic by fixed ID, preserves
existing fields and returns the count added. Options never merges snapshots itself.

setSavedItems, setVisits and setClassificationCache replace the full collection;
they do not merge independently fetched snapshots. Future UI must use background
atomic actions for incremental changes rather than client-side read-modify-write.
Visits are VisitRecord[] with unique productId and nonnegative integer timestamps.
ClassificationCache maps product identities to {classification, source, cachedAt};
source is ai or keywords, cachedAt is an epoch timestamp. There is no memory cache.

Legacy `items` is validated and merged by ID into `unhaul:items`, preferring existing
namespaced records. The legacy key is removed only after persistence succeeds.
Copy/cleanup failures propagate and retries are idempotent. Malformed legacy data
is preserved with an error; legacy data never grants consent.

Delete-all removes every `unhaul:` key, including future cache keys, and legacy
`items`, while preserving unrelated storage. It works even with malformed data.
Later reads do not recreate settings. Explicit initialization or later user writes
can create data again. Existing options controls disable while pending and show
errors; existing consent, saved-list and controller actions remain the source of truth
for their corresponding app views.

## Installation consent and options gating
On first installation the background awaits storage initialization, then opens the
options page. Updates initialize safely without opening onboarding. Browser startup
still initializes storage. Initialization/opening failures are logged separately.

### Options app
The options page is a full-page app opened in its own tab from the extension action.
Hash routes (`#home`, `#items`, `#saved`, `#dashboard`, `#settings`) show one view at
a time, with the navigation state and view heading updated accessibly. Home computes
journey progress and summary tiles from settings, owned items and saved records; Ready
is derived from each absolute deadline and is never persisted. Saved and Dashboard
continue to use their existing read-only client-backed renderers. Settings reuses the
existing consent and deletion controller actions, with a confirmation step for deletion.
The sidebar becomes a horizontal navigation bar on narrow screens. No new permissions,
storage keys, settings fields or network behavior are introduced.

The optional cooling-off lock is off by default and persists as an existing optional
settings field. When enabled, the background compares the current product's stable
identity against waiting saved records and returns only a lock result to content.
Content fails open until that result is available, holds only matching add-to-cart
intent, and presents an in-memory per-tab Unlock anyway choice without redispatching
the merchant event.

Options starts with Home and other application controls hidden in the HTML,
shows loading while reading settings through the typed client, and reveals My Items
only after true consent and a successful item read. Missing consent resolves to
false without a write. Failed reads show a Retry action. Agreement awaits the
existing setConsent mutation, then rereads settings before displaying items. Not now
does not write or delete anything. Controls disable during saving and errors are
announced. A storage-change listener immediately hides/clears rendered items when
settings disappear or consent becomes false; revision tokens discard stale reads
and pending agreement results. Deletion returns to consent without initialization.

Copy accurately describes Daraz observation as planned and AI as disabled. This
phase does not enforce consent in the content script: its existing PING check is
unchanged, and product collection is not implemented. Actual Chrome installation
and UI interaction remain unverified in this managed browser environment.

## Consent enforcement — requested Phase 4
GET_CONSENT now responds with {consentGiven: boolean}. Only a literal boolean true
allows content startup. Missing/invalid settings, read failures, malformed responses,
message rejection and a three-second consent timeout all deny startup. PING/PONG
remains available in the background; the content connectivity check runs only after
consent. No product reader, shopping observer, UI or AI pipeline was added.

Before consent only a lightweight storage-change listener is registered. Content
revocation stops its lifecycle immediately, aborts its signal, invalidates pending
results and invokes registered cleanups. Future mounts, observers and shopping-event
listeners must register cleanup using scope.onCleanup, fetch must use scope.signal,
and asynchronous continuations must check scope.isCurrent. Cleanup also runs on
WXT context invalidation and the storage listener is removed. An already-open tab
can initialize safely on agreement without a reload; concurrent startup is deduped.
The existing connectivity check cannot be physically cancelled, but late results
are discarded and no late PONG is logged after revocation.

Background enforcement is independent of the content gate. GET_CONSENT reads through
the repository and fails closed. PRODUCT_SEEN, ADD_TO_CART_CLICKED and SAVE_ITEM
validate their requests and acquire a consent work scope before responding with an
explicit NOT_IMPLEMENTED error; they do not currently collect or classify anything.
Onboarding/settings and owned-item management remain available without consent.

The repository's setVisits, setClassificationCache and setSavedItems recheck consent
and the generation immediately before writing within the existing queue. Revocation
and delete-all invalidate outstanding background work immediately when called;
settings-removal/false/malformed storage events also invalidate it. Queued writes
captured before invalidation fail. Deletion runs after any already-issued storage
write, then removes all Unhaul records, so an in-flight commit cannot outlive deletion.
Reads never recreate settings. New explicit user operations after fresh consent are
allowed; old work tokens remain invalid even after re-agreement.

Future asynchronous product handlers must call beginConsentWork before processing,
use work.signal for cancellable requests, call verifyConsentWork before using late
results, pass the same work token into a sensitive setter, and release in finally.
The setters verify again inside their queue at commit time. Tokens are background
objects and cannot be supplied through content/storage messages. The promise queue
must not be held across network requests. Add atomic background operations for
incremental visits/cache updates rather than read-modify-write snapshot messages.
AI, actual product extraction, UI cleanup with real mounted shopping components and
native Chrome behavior remain unverified/unfinished; this task provides their guard
and lifecycle integration points rather than pretending those features exist.

## Phase 6 classification and matching
Keyword rules use shared taxonomy, whole-word matching and longest phrases, checking
the title before broad public metadata. Unknown remains other/other. Matching uses
same category and specific type; a known conflicting purpose excludes a candidate.
Matching-purpose candidates rank first, then stable input order. Only strong type
matches are returned, capped at three, with reasons; totalMatches is uncapped.

The background analysis service handles PRODUCT_SEEN (basic/cached analysis) and
REFINE_PRODUCT (optional model result/fallback). Response validation covers taxonomy,
match records, count and phase. A per-document/frame session plus analysisId prevents
superseded variant replies. Sessions are bounded and expire on subsequent requests;
MV3 restart can discard sessions, in which case clients request basic analysis again.
The content analysis helper ignores late revisions/signals and publishes basic first.
It is an integration helper, not a product reader or mounted UI. Repeat visits and
expanded discount prompts remain outside this phase.

Before analysis and outbound calls the background checks current consent; it verifies
again before publishing and committing. Atomic cacheClassification joins the existing
queue and checks the same work token at commit. Revocation/deletion aborts scopes;
old results cannot repopulate data even after re-agreement. Each session permits one
in-flight refinement. Cached AI keys include classifier/model version, origin, store,
product ID and variant ID. AI entries expire after 24 hours; temporary failures are
not cached. Full-snapshot UI cache mutation is not used by analysis.

Worker/provider setup and security boundaries are in proxy/README.md. Only public
title/category text/image leave the background. Public CDN image bytes are validated
and relayed as data, avoiding provider URL fetching. The API key remains server-side;
public extension tokens and Origin headers are not durable authentication.

## Phase 7 reflection experience
The consent lifecycle now mounts the structured reader/UI, registering all cleanup
through its scope. No product/UI observers are registered before agreement. A single
closed Shadow DOM host contains a small badge and nonmodal dialog; text is assigned
through textContent, with no product/user HTML injection. Keyboard Escape closes the
panel, visible focus is styled, and dismissal restores the trigger when connected.
The panel is responsive and scrollable; it does not trap focus or block checkout.

A throttled mutation observer, variant input/change listeners and URL-change checks
update product snapshots. Path changes immediately discard old UI/analysis and wait
for changed metadata. The reader rejects canonical mismatches, parses JSON-LD first
and product OG second, and leaves unsupported/missing prices empty. Variants require
SKU-specific offer evidence for price. This minimum reader replaced the extraction
placeholder solely to connect the existing Daraz scope; it has no live-store proof.

Generation checks and the Phase 6 client reject old publications; revocation/invalidated
contexts remove the host, disconnect observers, clear timers, remove all event
listeners, cancel client publications and abort consent scopes. The host is reattached
if a merchant rerender removes it; duplicate roots/analysis are avoided.

Capture listeners observe cart-labelled buttons/form submitters without cancelling
or stopping merchant events. They represent interaction intent, not purchase/cart
success. Background claimPanelOpen serializes consent-guarded storage.session claims
per tab/product. They survive reload/worker suspension, clear on tab close/restart
or delete-all, and conservatively deny new claims beyond 500 product IDs. No new
manifest permission is required for tabs.onRemoved; no URL/title tab access is used.

Prompt order: relevant matches, verified higher previous price with known currency,
recorded repeat visit, generic. Existing visit history is read only; there is no new
visit recording. UI error/loading states do not invent counts. Save remains disabled
with explicit text because the cooling-off API/UI is not implemented. No success
message is shown. Product images are optional public URLs with no-referrer policy;
owned-item names/reasons remain text inside the closed shadow root.

## Phase 8 cooling-off implementation
SAVE_ITEM validates the product and wait key, then calls background saveProduct.
Read/validation/duplicate detection/write are one queued operation, with current
consent and generation checks at commit. Responses include the persisted record.
The content scope guards new requests; panel revisions discard UI acknowledgements
for an old product or removed panel. Persistence success is never shown early.

Saved records use a per-save UUID, a complete product snapshot, savedAt,
reconsiderAt and compatibility deadline, wait and status. Stable identity is separate:
store + productId + variantId. Waiting/Ready duplicates return already_saved and the
original record/deadline without a write. Decided records are immutable; resave appends
a new record and retains decision history. Skip/Purchased are serialized mutations
with decidedAt; same decisions are idempotent and conflicting edits are rejected.

Legacy records with a productId record ID or only deadline remain valid. No automatic
rewriting or deletion occurs. New reconsiderAt must equal deadline; malformed or
unsupported records produce a retryable read error rather than a fabricated Ready.
Full-snapshot setters remain internal compatibility APIs; the UI uses atomic actions.

The options saved-list module loads only after consent, reads through the typed
client, renders safe HTTP(S) links/text/images, separates active and history cards,
and refreshes on storage changes/focus/visibility. Only a visible-page interval
updates labels; absolute timestamps are authoritative and independent of worker
lifetime. Disposal clears timers/listeners and stale read generations; deletion or
consent removal immediately clears/hides records. Missing fields are unavailable,
not guessed. No notification, budget, analytics or automatic purchase feature added.

## Current AI contract — Phase 6 gap review
The active Cloudflare Worker POST /classify calls OpenAI gpt-4o-mini chat completions
with strict JSON schema. Only title, categoryText and imageUrl leave the extension;
owned items, notes, visits and saved lists are excluded. AI_API_KEY is set only with
`wrangler secret put AI_API_KEY`. EXTENSION_TOKEN is an optional abuse hurdle,
not a durable secret. PROXY_URL identifies the Worker. No provider key is embedded.

The proxy checks an explicitly allowlisted chrome-extension origin (declared and
actual origins must agree), JSON content type, the optional token and Cloudflare
rate binding (30/minute/IP). Bodies are capped at 2048 bytes with only those three
fields: nonempty title <=1024 characters, categoryText <=512, imageUrl null or an
approved/configured HTTPS CDN URL without credentials, fragment or nonstandard port.
Images reject redirects, cap bytes at 512 KiB and check JPEG/PNG/WebP signature/MIME;
validated bytes are sent as a low-detail data URL. Replies are bounded and validated
against category/type pairs, purposes and confidence. Confidence below 0.5 becomes
other/other/other; invalid output is rejected, not partially merged. Errors are
generic and request bodies/credentials are not logged. Upstream code is unchanged.

Keywords render immediately. Any proxy failure, offline, invalid reply or 3-second
extension timeout retains keywords; temporary failures are not permanently cached.
The Worker separately aborts image/upstream work after 2.5 seconds. Deployment,
operator spending caps and live accuracy remain unverified.

Configuration names: PROXY_URL and EXTENSION_TOKEN for extension/evaluation;
AI_API_KEY (secret), optional EXTENSION_TOKEN (secret), ALLOWED_ORIGINS, IMAGE_HOSTS
and CLASSIFY_RATE_LIMITER for the Worker. The accuracy CLI also needs UNHAUL_ORIGIN,
a real allowlisted extension origin; it must never fabricate an origin or read the
provider key. Run from extension with `npx tsx scripts/accuracy.ts`.


## Build notes (moved from README, 2026-11-10)
These are the per-phase notes that used to live in the README. They are history; where they disagree with the code or requirements.md, the code and requirements.md win (for example, the store list is now `src/store/stores.ts`, not Daraz only).

A Chrome extension that helps users reconsider impulse purchases across categories:
stationery, home décor, toys, electronics, clothing and more.

### Status (2026-11-10, submission build)
MVP features FR-01 to FR-17 are implemented; see `docs/requirements.md` for each one's status
and what is verified. AI refinement runs only when the proxy is deployed and `PROXY_URL` /
`EXTENSION_TOKEN` are set at build time; otherwise the keyword fallback is used and the panel
still works.

### Install (judges)
1. Download `unhaul-*-chrome.zip` from the latest GitHub Release and unzip it.
2. Open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the unzipped folder.
3. The consent page opens. Click **Agree**, then **Load sample items** and quick-add one or two of your own.
4. Open a product page on a supported store, for example
   https://outfitters.com.pk/products/f0283-113, or any product on the stores listed below.
5. Click Add to cart. The store adds it as normal and the Unhaul panel opens. Choose **Save for later**.
6. Open the extension's options page to see the cooling-off list, countdown, Skip and Purchased.

### Supported stores
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

### Development
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

### MVP scope
One verified shopping website with multiple categories; My Items; product extraction;
matching; a reflection panel; Save for later; a persistent cooling-off list.
Checkout is never blocked. Saving must not change the merchant's cart.
Keep owned items and visit history local. If AI is enabled later, disclose the public
product information transmitted to the proxy/provider.

### Ownership
- A: store adapters, content script, badge, panel, product fixtures.
- B: shared contracts, classification, AI proxy, matching, labelled evaluation.
- C: storage, consent/options page, cooling-off list, packaging and documentation.

See `docs/phase-2-handoff.md` for the PING/PONG walkthrough and A/B handoff.
See `docs/requirements.md` for implementation status and `SUBMISSION.md` for handoff.

### Planned proxy settings
Copy the root `.env.example` to `.env` when needed. `PROXY_URL` and `EXTENSION_TOKEN`
are reserved for later integration and are not read or bundled by this phase.
An extension-distributed token cannot be treated as a durable secret.

### Storage development
All active extension storage access belongs to the background repository. UI/content
uses `extension/src/storage/client.ts`; do not import repo.ts into an entrypoint
other than background. See docs/design.md for validation, legacy migration,
full-snapshot setter semantics and delete-all behavior.

### Fictional sample items
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

### Classification and matching (Phase 6)
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

### Reflection UI (Phase 7)
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

### Cooling-off list (Phase 8)
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

### Concurrent incoming work
The Phase 8 merge retained new fixture files and their saver script. Conflicting
source drafts from the incoming branch contained unresolved merge markers and an
alternate notification/budget UI; exact copies are preserved under
`docs/merge-preservation/` for separate integration. They were not activated in this
storage/save-flow task, and existing consent/storage contracts remain in use.
## Custom store permissions

The built-in store permissions remain install-time permissions. Settings can request
one HTTPS origin at a time through Chrome's optional host-permission prompt. Granted
origins are the source of truth; the background registers the existing content script
dynamically for those origins and unregisters it when access is removed. Content receives
only a site-enabled decision and uses the generic product reader on custom paths.
