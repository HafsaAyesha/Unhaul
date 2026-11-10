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

## Storage initialization
Keys are centralized in `extension/src/storage/keys.ts` under `unhaul:`. Settings
use schemaVersion 1 and consentGiven; missing settings default to false on install
and browser startup. Existing settings are validated and preserved, including extra
fields. Invalid/unsupported records produce errors instead of silent replacement.

The legacy `items` array is copied to `unhaul:items` before removing the old key.
Existing namespaced items are retained; disjoint legacy IDs are merged and identical
records deduplicated. Conflicting IDs or malformed data halt migration without
removing originals. Failed cleanup can be retried safely. No consent is inferred
from owned items. Operations are serialized within a context; cross-context mutation
routing remains for the later storage-wrapper phase. Existing get/set item calls
also initialize storage to cover options opened before lifecycle handling completes.
No empty lists or caches are created solely for initialization.
