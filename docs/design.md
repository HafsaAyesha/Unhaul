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
