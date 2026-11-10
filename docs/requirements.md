# Requirements and scope
Updated general-shopping MVP; original clothing-only fields are replaced by category,
item type and optional purpose. Four-to-five-hour estimate assumes three teammates.

| ID | Feature | Status (2026-11-10) |
| --- | --- | --- |
| FR-01 | First-run consent; nothing runs on stores until agreement | Implemented, automated + synthetic Chromium checks |
| FR-02 | Product pages recognized on the supported stores with one generic reader | Implemented; 21 stores in `src/store/stores.ts`; fixtures pass `npm run fixtures:check` |
| FR-03 | Title, price, currency, image, product ID | Implemented (JSON-LD Product/ProductGroup, then Open Graph); price left empty when variants differ |
| FR-04 | Product change without reload | Implemented (400 ms URL check, popstate/hashchange and page-data changes); not timed on live stores |
| FR-05 | Visits recorded locally, deduplicated within 30 min | Implemented (`recordVisit`, unit tested) |
| FR-06 | Add to cart watched without blocking except for matching cooling-off products | Implemented |
| FR-07 | Sample items, no duplicates on repeat | Implemented |
| FR-08 | Quick-add owned item | Implemented |
| FR-09 | List owned items; delete all data | Implemented |
| FR-10 | AI classification through the proxy | Implemented, unverified live: no proxy deployed at release; AI accuracy unmeasured |
| FR-11 | Keyword fallback | Implemented |
| FR-12 | Matching, up to 3 with reasons | Implemented |
| FR-13 | Badge and panel, auto-open once per product per session | Implemented |
| FR-14 | Rule-chosen question | Implemented |
| FR-15 | Save for later 24 h / 3 d / 7 d | Implemented |
| FR-16 | Cooling-off list survives restart | Implemented; unit tested; native Chrome restart unverified until the demo run |
| FR-17 | Skip and Purchased | Implemented |
| FR-18 | Cooling-off lock on by default for matching saved products; end early only from Unhaul | Implemented |
| FR-19 | Enable one additional HTTPS store origin at a time through Chrome optional host permissions | Implemented |

## Non-functional targets (measured results only)

| ID | Target | Result |
| --- | --- | --- |
| NFR-01 | Badge within 1.5 s of page load (10 pages) | Not measured |
| NFR-02 | AI median under 2 s; give up at 3 s | 3 s timeout implemented and unit tested; median not measured (no proxy deployed) |
| NFR-03 | AI item type accuracy at least 80%, and 15 points above keywords | Not measured. Keywords alone: 3 of 4 labelled products (75%); only 4 labels, not a benchmark |
| NFR-04 | Panel shows every time with the proxy off | Keyword fallback unit tested; the release build has no proxy, so every demo run exercises it. Not counted by hand |
| NFR-05 | 5 quick-adds in under 60 s | Not measured |
| NFR-06 | Judge finishes the demo in under 5 min on a fresh browser | Not measured |
| NFR-07 | 0 requests carrying owned items or history | By code review: the only extension request is POST /classify with title, categoryText and imageUrl, and the release build makes none. Not measured in the Network tab |
| NFR-08 | Add to cart works 10/10 when no matching product is cooling off | Not measured. Matching cooling-off products are intentionally held |

The sections below are earlier per-task notes kept for history. The tables above are the current status.

Deferred: notifications, pause-on-site, budget/insights, untimed saves, purchased-to-items.
Not building: checkout blocking, purchase detection, accounts, cloud sync.

## Installation consent task
Implemented: install-only options opening, loading/error/Retry states, explicit
agreement through the background API, Not now without writes, My Items gating,
revocation handling and return to consent after deletion. Content-script consent
enforcement remains a separate task; product observation/AI remain unfinished.
Native Chrome install/UI behavior is unverified; see testing.md.

## Consent enforcement task
Implemented: validated GET_CONSENT, fail-closed content startup with timeout,
storage-change revocation/re-agreement, WXT invalidation cleanup, background
sensitive-write guards and stale-work generation checks. Product/AI handlers remain
unfinished and return explicit errors. The gate currently controls only the existing
connectivity check; it adds no product collection, shopping UI or network requests.
Native browser verification is unrun. The earlier note that content consent gating
was a separate task is superseded by this section.

## Phase 6 status
Implemented: title-first keyword rules, strong type matching with reasons/limit/count,
background basic/refinement analysis messages, consent-aware atomic cache and stale
result protection, proxy origin/rate/size/image validation and model request path.
Unverified: live proxy/provider invocation, provider costs/latency, actual image
classification and accuracy targets. Missing configuration/deployment prevents live
AI validation. No real fixtures exist. Badge rendering and automatic product reading
remain separate unfinished integration tasks; no new screens/stores were added.

## Phase 7 status
Implemented: consent-bound closed Shadow DOM badge/nonmodal panel, manual/interaction
opening, current product and explained matches, prompt priority, session opening
limits, stale-result handling, safe text, keyboard dismissal/focus and cleanup.
A minimal structured reader connects the previously empty extractor for Daraz only.
Unverified: live merchant metadata/cart behavior, native extension lifecycle and
full real-store variant behavior. Synthetic Chromium tests are not live-site evidence.
Deferred dependency: Save for later remains disabled with an explanation; Phase 8
cooling-off persistence/UI is not implemented. AI remains unverified/unconfigured
as described in Phase 6. No new stores or checkout interception were added.

## Phase 8 status (supersedes the Phase 7 save limitation)
Implemented: duration selector and acknowledged saving, persisted product snapshots,
variant-aware active deduplication, absolute reconsiderAt/deadline, Ready/countdowns,
consent-hidden saved list with refresh/error/empty states, immutable Skip/Purchased
history, resave preservation, and delete-all compatibility. No alarms/notifications.
Unverified: native Chrome restart acceptance and live Daraz behavior. Repository
reload/persistence and synthetic UI checks are evidence only for those test targets.
