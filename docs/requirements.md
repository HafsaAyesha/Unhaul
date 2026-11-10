# Requirements and scope
Updated general-shopping MVP; original clothing-only fields are replaced by category,
item type and optional purpose. Four-to-five-hour estimate assumes three teammates.

| Requirement | Status |
| --- | --- |
| FR-01–03 product extraction and navigation | Store adapter placeholder |
| FR-04–05 badge and reflection triggers | UI helpers only; integration pending |
| FR-06–07 My Items | Sample load/list/delete-all implemented; manual add/delete pending |
| FR-08 matching | Basic category/item-type matching implemented |
| FR-09 AI classification | Proxy and client placeholders; not integrated |
| FR-10 reflection selection | Basic match/no-match prompts only |
| FR-11–12 cooling-off list | Pending |
| FR-13 persistent deadlines | Pending; browser notifications deferred |
| FR-14 delete all data | Options-page control implemented |
| FR-15–23 additional features | Deferred: insights, purchased-to-items, notifications, pause controls, generated prompts, budget, extra stores, cart recognition, untimed saves |

Acceptance: validate extraction across categories, preserve merchant Add to cart,
keep save deadlines after restart, show Ready when reopened, handle AI failure,
and clear all local data. These end-to-end checks have not yet been run.
No checkout freezing, automatic purchase verification, accounts or cloud sync.
No AI accuracy, latency or usability target is claimed as achieved.

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
