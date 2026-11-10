# Design
Content script → background messages → classifier/matcher/storage → page UI.
Options page manages consent, My Items and saved items. The service worker must not
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
Current proxy fails closed and makes no provider calls. Consent UI is not yet functional.

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
errors; no new consent, saved-list or other screen is implemented by this task.

## Installation consent and options gating
On first installation the background awaits storage initialization, then opens the
options page. Updates initialize safely without opening onboarding. Browser startup
still initializes storage. Initialization/opening failures are logged separately.

Options starts with My Items and other application controls hidden in the HTML,
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
