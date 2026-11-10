# Phase 9 integration audit — 10 November 2026

Audit baseline: `6787040` (the main tip when `phase9-integration` was created).
This is a code/integration audit, not a live store or native Chrome acceptance test.
“Done” means the implementation and cited unit coverage exist, not that a live
merchant/demo passed. Bigger gaps were documented instead of built. No new tests.

During validation main advanced to `68eb093`. This branch deliberately retains the
checked baseline rather than claiming the incoming code passed the already-run
checks. See the incoming-main note below before acting on findings. The later
Phase 7 polish commit `d39a85c` and unfinished Phase 8 gap task were not merged into
this baseline; the premise that every gap task has merged is not satisfied.

## Requirements

| ID | Status | Evidence and limitation (paths relative to repository root) |
|---|---|---|
| FR-01 | Done | `extension/entrypoints/background.ts:30` install-only options; `extension/entrypoints/options/controller.ts:45` loading/consent gate; `extension/entrypoints/content.ts:13` consent lifecycle; native install manual. |
| FR-02 | Partly done | `extension/src/store/stores.ts:5` six domains, each bare/www; `extension/src/store/extract.ts:23` generic reader. Context section 5 names different stores; no runtime Shopify JSON fallback (`extension/src/store/shopify.ts:3` is a stub). |
| FR-03 | Partly done | `extension/src/store/extract.ts:33` JSON-LD graph/arrays, ProductGroup and offers, then OG at line 55. `og:price:*`, comma prices, Shopify fallback absent; empty schema title does not fall back to OG; variant IDs only matched to offer SKU. |
| FR-04 | Partly done | `extension/src/ui/experience.ts:106` navigation reset; line 141 popstate/hashchange and line 143 URL polling. No history wrapping; unchanged source signature blocks reread at line 76. Live product/variant correctness manual. |
| FR-05 | Missing | `extension/entrypoints/background.ts:86` PRODUCT_SEEN calls analysis only; `extension/src/classify/analysis.ts:25` only reads visits; `extension/src/storage/repo.ts:182` snapshot setter has no automatic caller/dedup/pruning rule. See incoming-main note: later addressed. |
| FR-06 | Done | `extension/src/ui/experience.ts:117` capture click/submit watcher, line 127 expressly does not cancel merchant actions. No live store success proof. Separate ADD_TO_CART_CLICKED message remains NOT_IMPLEMENTED at `extension/entrypoints/background.ts:94`; watcher never sends it. |
| FR-07 | Done | `extension/src/storage/repo.ts:108` sample merge by fixed ID; `extension/entrypoints/options/controller.ts:78` UI action; `extension/tests/storage.test.ts:106` concurrent dedup test. |
| FR-08 | Done | `extension/entrypoints/options/index.html:22` form; `extension/entrypoints/options/main.ts:75` handler; `extension/entrypoints/options/controller.ts:22` validated item construction and line 89 queued client save. |
| FR-09 | Done | `extension/entrypoints/options/main.ts:44` item list; `extension/src/storage/repo.ts:217` all prefixed local/session plus legacy deletion; `extension/entrypoints/options/controller.ts:131` returns to consent. |
| FR-10 | Partly done | `extension/src/classify/ai.ts:23` public-only request; `proxy/src/index.ts:105` OpenAI gpt-4o-mini; `extension/src/classify/analysis.ts:55` refinement/cache. No proxy URL/token supplied; actual AI deployment/inference unverified. |
| FR-11 | Done | `extension/src/classify/ai.ts:19` 3 s timeout, line 47 catches failures; `extension/src/classify/analysis.ts:63` null AI uses keywords. |
| FR-12 | Done | `extension/src/match/match.ts:5` specific type/category, purpose conflict exclusion, confidence gate; line 13 returns top three and totalMatches separately. |
| FR-13 | Done | `extension/src/ui/experience.ts:57` closed Shadow DOM, badge/panel, line 128 claimAutoOpen; `extension/src/storage/repo.ts:236` per-tab/product storage.session marker. Badge wording/basic label polish not in this baseline. |
| FR-14 | Partly done | `extension/src/match/prompts.ts:3` required priority; `extension/src/classify/analysis.ts:28` recorded-history check. Automatic repeat-visit branch unreachable from fresh normal usage while FR-05 is missing. |
| FR-15 | Done | `extension/src/ui/panel.ts:33` three waits; line 46 awaits save; `extension/src/storage/repo.ts:123` variant-aware dedup, UUID and absolute deadline; line 138 duration arithmetic. |
| FR-16 | Partly done | `extension/src/shared/cooling.ts:6` computed deadline state; `extension/entrypoints/options/saved-list.ts:76` rereads/recalculates on refresh/focus. Persistence module-reload test exists; real Chrome restart not checked. |
| FR-17 | Done | `extension/entrypoints/options/saved-list.ts:52` Skip/Purchased; `extension/src/storage/repo.ts:147` immutable decisions/decidedAt. Purchased explicitly self-reported. |

## Demo story

| Step | Status | Evidence / remaining check |
|---|---|---|
| 1 Install and agree | Partly done | `extension/entrypoints/background.ts:30`, `extension/entrypoints/options/controller.ts:62`; code/unit tests exist, fresh Chrome installation manual. |
| 2 Samples and two quick-adds | Done | `extension/src/storage/repo.ts:108`, `extension/entrypoints/options/controller.ts:89`; exact two-entry human demo manual. |
| 3 Supported product badge | Partly done | `extension/src/ui/experience.ts:57`, `extension/src/store/extract.ts:23`; reader/fixture/store coverage limitations above. |
| 4 Add-to-cart, panel and merchant action | Partly done | `extension/src/ui/experience.ts:117`; synthetic smoke script exists, live merchant operation manual. |
| 5 Save with deadline and cart disclaimer | Done | `extension/src/ui/panel.ts:33`, `extension/src/ui/panel.ts:49`, `extension/src/storage/repo.ts:138`; persistence is acknowledged before success. |
| 6 Restart Chrome, retain countdown | Partly done | `extension/tests/storage.test.ts:251` module reload only; actual Chrome restart manual. |
| 7 Ready and Skip/Purchased | Done | `extension/src/shared/cooling.ts:12`, `extension/entrypoints/options/saved-list.ts:52`; no automatic purchase detection. |

## Integration mismatches

- Message contracts/senders/handlers: PING, GET_CONSENT, CLAIM_PANEL_OPEN,
  PRODUCT_SEEN, REFINE_PRODUCT, SAVE_ITEM and STORAGE have active handlers.
  `extension/src/shared/messages.ts:24` declares ADD_TO_CART_CLICKED → OK, but the
  guarded handler returns NOT_IMPLEMENTED (`extension/entrypoints/background.ts:94`).
  It has no runtime sender, so the actual cart watcher works independently. Smallest
  future correction: acknowledge OK under the existing consent guard; do not rebuild
  the watcher. Left unchanged because behavior is explicitly unfinished in baseline.
- `consentGiven`, `unhaul:settings`, `unhaul:items`, `reconsiderAt`/legacy `deadline`,
  `category`/`itemType` and cache names agree between active writers/readers.
  `extension/src/shared/storage-validation.ts:44` requires the two deadline fields
  to agree when reconsiderAt exists; `extension/src/shared/cooling.ts:7` supports
  legacy deadline-only records. Root/merge-preservation drafts are not active code.
- Storage reads/writes are repository-only. Native storage **subscriptions** break
  the stronger ownership rule: `extension/entrypoints/background.ts:17`,
  `extension/entrypoints/content.ts:37` (register/remove at 43/46),
  `extension/entrypoints/options/main.ts:93` (register at 100). Smallest correction:
  repository-owned change subscription plus validated background notifications;
  preserve immediate revocation and update mocks. This is a refactor, not done here.
- Null amounts were not converted to numeric zero by either renderer. Both did
  display “Price unavailable”; now empty text in `extension/src/ui/panel.ts:77` and
  `extension/entrypoints/options/saved-list.ts:46`. The existing synthetic smoke
  assertion was adjusted (`extension/scripts/reflection-smoke.mjs:58`); not run.
- Main still has abbreviated cooling labels/Ready, uncollapsed decision history,
  no missing-image grey placeholder, and no dev one-minute wait. These Phase 8
  polish requests are not included here. Smallest fix: finish/merge the c-app gap
  task separately, then repeat acceptance manually.

## Network inventory and privacy

All active extension/Worker request sites and developer tooling are listed below.
Stored merchant HTML contains third-party scripts/URLs, but those fixtures are not
extension entrypoints or production-bundled code. Do not execute them as trusted code.

| Request | File:line | Data / assessment |
|---|---|---|
| Extension POST to configured HTTPS /classify | `extension/src/classify/ai.ts:26` | Body built at line 23: **only title, categoryText, imageUrl**. No owned items, notes, visits or saved-list collection; token/origin headers are operational metadata. Allowed. |
| Worker GET public image | `proxy/src/index.ts:46` | Approved/configured HTTPS CDN URL; rejects redirects, size and MIME/signature limits; allowed. |
| Worker POST OpenAI chat completions | `proxy/src/index.ts:105` | Model constant gpt-4o-mini at line 11; public title/category text plus validated image bytes; server-side AI_API_KEY. Allowed. |
| Panel image GET via img.src | `extension/src/ui/panel.ts:83` | Arbitrary HTTP(S) product-image URL after syntax check; no-referrer/anonymous but URL/path/query and client IP still leave device. **Outside the stated allowlist**; static code does not establish absence of tracking URLs. |
| Saved-list image GET via img.src | `extension/entrypoints/options/saved-list.ts:39` | Uses persisted product.imageUrl. No owned items/visit data serialized, but opening local saved list contacts remote image host. **Outside allowlist**. |
| Saved-product hyperlink (user initiated) | `extension/entrypoints/options/saved-list.ts:34` | Navigates to public stored product URL in new tab, no collection payload; ordinary explicit user navigation, not background telemetry. |
| Runtime same-origin Shopify product JSON | `extension/src/store/shopify.ts:3` | **Absent/stub**, no active fetch in extract.ts. An allowed request is not evidence it exists. |
| Accuracy CLI POST /classify | `extension/scripts/accuracy.ts:27` | Developer-only public labelled title/category/image; same three fields, no local user records. Not bundled. |
| Fixture collector navigations + product JSON | `extension/scripts/save-fixtures.mjs:58`, `:67` | Live public page and same-page .js. Developer-only; page loads can include merchant subresources. |
| Automatic collector catalogue/page/product JSON | `extension/scripts/save-fixtures-auto.mjs:65`, `:110`, `:123`, `:133` | /products.json?limit=250, home, chosen product, .js. Developer-only; not allowed runtime extension traffic and not bundled. |
| Candidate-store checker robots/catalogue/product/page | `extension/scripts/check-stores.mjs:50`, `:83`, `:91`, `:114`, `:124` | Public robots.txt, .js, catalogue limit=30 and page navigations; developer-only. |
| Fixture-check browser navigation | `extension/scripts/check-fixtures.mjs:81` | Intercepted at line 73 with local fixture; not a live-store validation. |
| Synthetic reflection smoke navigation | `extension/scripts/reflection-smoke.mjs:13` | Intercepted local HTML at line 12; no live merchant request. |
| Extension smoke pages | `extension/scripts/smoke-extension.mjs:38`, `:43`, `:64` | Product/nonproduct pages intercepted at lines 32/63, plus local extension options. Native extension test not run here. |

Static data flow: matching reads items/visits in `extension/src/classify/analysis.ts:24`
and keeps them in background memory; classifyAI receives only Product. No source
request serializes owned items, notes, visits or saved-item collections. Network-tab
verification remains **manual**, not inferred from these unit tests. Image-request
exceptions mean the strict network allowlist has **not** passed.

Production manifest, `.output/chrome-mv3/manifest.json:1`, built without PROXY_URL:
permissions exactly `["storage"]`; 12 HTTPS host patterns for bare/www variants of
Daraz, Bonanza Satrangi, Cross Stitch, Junaid Jamshed, Outfitters and Zellbury.
Content matches those hosts under `/products/*`. No `<all_urls>`, tabs or scripting.
No proxy origin is present because PROXY_URL is unset; `extension/wxt.config.ts:7`
validates and adds only its explicit HTTPS origin when configured. That configured
production build is unverified. Stores differ from stale context section 5 and include
Daraz without a saved Daraz fixture; domains were not changed in this audit.

## Secret/history search

Case-insensitive literal search for sk-, Bearer, secret, password and token covered
tracked HEAD blobs and every reachable blob/commit message under all fetched branch
refs (local worktrees included). Each unique blob is scanned once rather than
repeating unchanged contents for every commit. Every occurrence is recorded with
blob SHA, path, line, column and matched search term in `security-search-hits.tsv`;
commit-message occurrences are in `security-history-message-hits.tsv`. The scan covered 305 unique text/binary blobs (binary blobs without text were skipped),
558 literal-term hits in text blobs, and one commit-message hit across 41 reachable commits. Values and
surrounding credential-bearing text are deliberately not copied into the report.
Resolve an original historical finding with `git show <blob>` locally. The report
is a snapshot before this audit's new report files; it does not recursively scan itself.
Unreachable/deleted server-side refs and unavailable objects are outside the scan.

No confirmed private Unhaul/OpenAI provider key or literal production Bearer value
was found. Bearer in proxy source interpolates env.AI_API_KEY, not a committed key.
All sk- hits inspected were CSS/HTML words (mask-, desk-, ask-), not OpenAI keys.
Most secret/token/password hits are config names, validation, documentation, test
placeholders, dependency names and merchant HTML login/form/script names.

Credential-like public fixture values remain and must not be certified as private-key
safe solely because they came from a website:

| Captured configuration | Location | Assessment |
|---|---|---|
| Shopify accessToken | Beechtree HTML:46, Bonanza HTML:33, Cross Stitch HTML:443, Junaid HTML:1102, Outfitters HTML:37, Zellbury HTML:1166 | Public browser storefront configuration, not an Unhaul/provider secret. Appears in history too. |
| PostexBNPLConfig.apiKey | Cross Stitch HTML:6689 | Public merchant BNPL widget configuration; privilege/reusability unverified. Never exercised. |
| RestockRocket storefrontAccessToken | Junaid HTML:29899 (older blob at 29985) | Public storefront widget token, not an Unhaul credential; historical occurrence retained. |
| MyAliceWebChat token | Zellbury HTML:10331 | Public merchant chat-widget token; privilege/reusability unverified. Never exercised. |

No real secret was proven, so no speculative credential removal/history rewrite was
performed. Smallest release cleanup: scrub unnecessary executable/config sections
from captures while preserving product metadata; have the merchant/account owner
assess any genuinely privileged credential and rotate it if appropriate. Do not
claim historical values disappear after a normal commit. No secret values added.

## Fixes and priorities

Made only these small changes: removed the unknown-price placeholder in panel and
saved list; updated the existing synthetic smoke assertion accordingly. No new tests,
features, shared contract renames, permission changes, deployments or main commits.

1. **Strict network privacy mismatch:** remote panel/saved-list images are extra
   request paths. Smallest fix under this audit's allowlist: stop loading remote
   thumbnails and use local placeholders; alternatively explicitly agree a broader
   image policy before claiming it passes. Confirm with Network tab after consent.
2. **Release readiness / merge prerequisite:** merge the pending reader/UI/cooling
   branches and retest the final commit. This checked baseline lacks runtime Shopify
   fallback, visits and several Phase 7–8 gaps. See incoming-main note below.
3. **Reader/store mismatch:** align context/consent/permissions/fixtures to one verified
   domain list; add missing OG price aliases/grouped parsing and same-origin JSON
   fallback in the reader owner branch. Daraz /products-only matching is unverified.
4. **Storage ownership:** move only native change subscriptions behind the repository
   plus background notifications; keep cancellation/generation protections intact.
5. **AI deployment/configuration:** supply Worker secrets and allowed origins out of
   repo; build with proxy origin, measure real requests. Current four-label keyword
   score remains 75%; not an 80% AI result. Do not alter labels to inflate it.
6. **Fixtures/credential hygiene:** scrub public widget configs, retain a source map,
   obtain real nonclothing fixtures and recapture Beechtree as an actual product if
   that domain is retained. Existing labels point to four absent fixture files.
7. **Manual acceptance:** fresh Chrome install, live cart while panel open, variant
   changes, native restart/deadline and revocation with pending requests. Existing
   synthetic/module-reload checks do not prove these behaviors.

### Incoming-main note (not validated here)

`68eb093` arrived after this branch was created. Its `extension/entrypoints/background.ts:86`
now calls `recordVisit` before basic analysis and its `extension/src/storage/repo.ts:182`
adds queued deduplication/pruning. It also changes the guarded cart reply to OK.
Therefore FR-05 and the NOT_IMPLEMENTED finding above are baseline findings, **not
claims that current main still lacks those changes**. The new domain set/fixtures/docs
also differ. Reconcile this report against the final merged commit before submission.
No extra full-suite run was made, respecting the requested one-pass limit.
