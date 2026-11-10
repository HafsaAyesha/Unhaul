# Testing
From `extension/`: `npm run typecheck`, `npm test`, `npm run build`.
From `proxy/`: `npm run typecheck`, `npm run build`.

## Current status (release, 2026-11-10)
- Unit tests (Vitest): all pass on main. 103 at 68eb093, 105 once PR #10 is merged.
- Typecheck (extension and proxy) and production build: clean.
- `npm run fixtures:check`: 5 of 5 saved store pages pass (permissions, content-script injection, reader returns title, price and PKR).
- `npm run stores:check`: 21 stores in `src/store/stores.ts`; see "Submission checks" below for which passed and which were dropped.
- Release ZIP (`npx wxt zip`): `extension/.output/unhaul-extension-0.1.0-chrome.zip`, 27 KB, 7 files. Its manifest has only the "storage" permission and 42 host patterns (21 stores, bare and www), no all-sites access, and no proxy origin (built without PROXY_URL). No .env, keys or email addresses inside.
- AI accuracy: not measured, because no proxy was configured. Keywords got 3 of 4 labelled products (see "Phase 6 measured accuracy").
- By hand, still to do: fresh-profile demo run, 10 Add to cart clicks per store, badge timing on 10 pages, Network tab check, Chrome restart with a saved item.
- Cooling-off lock: storage and message tests cover consent, setting, identity/variant, status and deadline gates; UI tests cover locked cancellation, fail-open unknown/off states and per-tab Unlock anyway.

## Edge cases
| Case | Covered by |
| --- | --- |
| Product with no price | Unit tests (reader returns null price; display shows nothing) |
| Page that isn't a product | Unit tests (reader returns null; no UI) |
| Move to another product without reload | Unit tests (reflection experience); manual on live stores |
| AI slow, offline or invalid reply | Unit tests (timeout and fallback to keywords) |
| Same product saved twice while waiting | Unit tests (already_saved keeps deadline) |
| Chrome restarted during a wait | Unit tests (deadline-based countdown); manual native restart |
| Consent withdrawn or Delete all with a store page open | Unit tests (consent lifecycle) |
| Load sample items twice | Unit tests (no duplicates) |
| Item type other, or weak evidence only | Unit tests (no match) |
| Title containing HTML | Unit tests (rendered as text) |
| Add to cart still works with the panel open | Manual (NFR-08) |
| Custom HTTPS origin normalization rejects unsafe URLs and strips paths | Vitest (`custom-sites.test.ts`) |
| Custom permission registration replaces dynamic scripts and removes them when empty | Vitest (`custom-sites.test.ts`) |
| Missing cooling-lock setting defaults on; explicit off, ready, skipped, purchased and ended-early items lift the lock | Vitest (`cooldown-lock.test.ts`, `storage.test.ts`) |
| End-wait-early mutation is validated and denied to content senders | Vitest (`cooldown-lock.test.ts`, `storage-messaging.test.ts`) |

## Earlier task notes
## Scaffold validation — 10 November 2026
- Extension: TypeScript check passed; production Chrome MV3 build passed.
- Vitest: 1 test file, 3 tests passed; no failures or skips.
- Proxy: TypeScript check and Wrangler deployment dry-run passed.
- Local proxy: GET /health returned 200 with classificationEnabled=false;
  POST /classify returned the expected 503 (not configured).
- Wrangler used XDG_CONFIG_HOME=/workspace/.unhaul-config and metrics disabled
  because the managed machine does not permit writes to the default home config.
  It warned about unavailable Request.cf metadata and used its local fallback.
- Chrome UI interaction, real store integration and complete MVP flow: unrun.
- No Cloudflare deployment or GitHub release was performed.

## Phase 2 validation — 10 November 2026
- Extension typecheck and production build: passed.
- Vitest: 2 files / 6 tests passed, including content→background PING/PONG using a
  mocked Chrome transport, malformed-message/sender rejection, and failure logging.
- WXT dev server: started successfully; generated chrome-mv3-dev output.
- Production manifest: storage only; host https://www.daraz.pk/*;
  content script https://www.daraz.pk/products/* only.
- Real Chromium smoke check: attempted, not passed. Managed extension blocklist
  prevented worker/injection startup; the check timed out waiting for PONG.
- Alternative Playwright Chromium installation: blocked by 403 Domain forbidden
  from cdn.playwright.dev. Native browser messaging remains unverified.
- Live Daraz request: blocked by proxy 403 CONNECT; live product check is pending.
- Repeatable browser/manual steps and A/B handoff: phase-2-handoff.md.

## Storage initialization — 10 November 2026
- `npm test`: 3 files, 24 tests passed; zero failures/skips.
- `npm run typecheck`: passed.
- `npm run build`: passed; production permissions unchanged.
- Focused checks cover absent/default settings, true/false consent preservation,
  unsupported settings, repeated/concurrent initialization, lifecycle hooks/errors,
  legacy-item preservation/merging/conflicts and copy/cleanup failures.
- Browser installation/startup/restart behavior was not manually verified in this task.

## Background-owned storage wrapper — 10 November 2026
- `npm test`: 4 files, 40 tests passed; zero failures/skips.
- `npm run typecheck`: passed.
- `npm run build`: passed; production manifest still requests only storage and the
  existing Daraz host permission, and existing PING/PONG tests pass.
- Added checks cover typed-client→background→repository integration using mocked
  Chrome transport/storage, request/response validation, sender restrictions,
  sample-load deduplication, duplicate-ID rejection, concurrent mutations, ordered
  reads behind delayed writes, queue recovery, all collection snapshots, schema
  rejection, migration conflict preference/retry, and namespaced deletion.
- Existing options actions now use the typed client, disable pending controls and
  display operation errors. No new screens were added.
- Manual Chrome UI/restart testing was not performed in this task; transport tests
  do not establish native Chrome messaging or live-store behavior.

## Installation consent / requested Phase 3 — 10 November 2026
- `npm test`: 5 files, 56 tests passed; zero failures/skips.
- `npm run typecheck` and `npm run build`: passed.
- New tests cover install versus update/startup, initialization/opening failures,
  loading/false/missing-default consent, invalid/failed settings and Retry,
  successful agreement awaiting persistence, duplicate clicks, save failure,
  Not now without writes, deletion, and revocation during pending reads/agreement.
- Tests use the existing Vitest infrastructure and mocked extension transport;
  there is no new testing framework.
- Native Chrome installation opening and options interaction: unrun. The managed
  Chromium policy still contains ExtensionInstallBlocklist=["*"]. No policy was
  changed. These automated results are not proof of native lifecycle/UI behavior.
- Content-script consent enforcement and product observation/AI remain outside
  this task. No new permissions, tracking, network calls or unrelated screens.
- After merging the teammate's Phase 3 shared-contract updates from main: reran
  the complete suite (5 files, 59 tests passed), typecheck and production build;
  all passed. Onboarding uses the merged active contracts without replacing them.

## Consent enforcement / requested Phase 4 — 10 November 2026
- `npm test`: 6 files, 82 tests passed; zero failures/skips.
- `npm run typecheck` and `npm run build`: passed.
- Production permissions and store matching are unchanged; PING/PONG remains tested.
- New checks cover malformed/false/missing consent, rejected and timed-out requests,
  deduplicated startup, cleanup/abort, late results, WXT invalidation, agreement in
  an open tab, GET_CONSENT failure behavior, denied/unfinished product operations,
  sensitive-write guards, deletion races and old work after re-agreement.
- Existing browser smoke script now requires agreement before PONG and checks
  deletion suppresses subsequent startup. It remains unrun under the managed
  Chromium extension blocklist; native Chrome/live-store behavior is unverified.
- No product extraction, shopping UI/observer, visit pipeline or AI integration was
  added. Cleanup tests use registered test resources; real shopping components
  must use the documented scope cleanup/abort hooks when implemented.

## Sample expansion / requested Phase 5 — 10 November 2026
- Added one focused sample-data test; the existing journal match assertion now uses
  sample-01. No loader, migration, consent or matching behavior was changed.
- `npm test`: 7 files, 83 tests passed; zero failures/skips.
- `npm run typecheck` and `npm run build`: passed.
- Ten records, two per requested category; all IDs unique and deterministic;
  every record passes the runtime OwnedItem/taxonomy checks and has fictional notes.
- Fixtures directory contains only README.md, so real-product alignment is pending.
- Old sample IDs may coexist with the new set in existing installs; documented in
  README.md. No automatic migration or deletion was performed.

## Phase 6 — 10 November 2026
- Ran one integrated test pass: 8 files / 92 tests passed, no failures/skips, ~1.6 s.
- Added 7 compact focused tests and 2 analysis/cache integration cases; updated an
  existing product-handler expectation to basic analysis rather than NOT_IMPLEMENTED.
- Extension typecheck and production build passed. Proxy typecheck and Wrangler
  deployment dry-run passed, including the rate-limit binding. No deployment ran.
- Checks cover title precedence, synonyms/word boundaries, type/purpose exclusion,
  ranking/count/three-example cap, valid/invalid/low-confidence model replies,
  offline/timeout/abort, public-only payloads, allowed origins, body size, image host
  rejection/redirect refusal, rate-limit denial, vision payload construction, basic
  response before AI, variant-specific caching, and late results after deletion.
- Image bytes and provider replies in tests are synthetic/mocked; no real image
  decoding, live AI inference, rate-limit enforcement, merchant page or Chrome UI
  integration was verified. No real product fixtures exist. No accuracy claim.
- Missing AI_API_KEY, PROXY_URL and allowed extension origin, plus no deployed
  Worker, prevent live end-to-end validation. Keyword mode remains usable.

## Phase 7 — 10 November 2026
- Full suite: 9 files / 94 tests passed, no failures/skips (~1.5 s). Added only two
  focused unit cases: prompt priority and serialized per-tab opening claims.
- Focused integration recheck: reflection + storage messaging, 12 tests passed.
- Extension typecheck and production build passed. Final permissions remain storage
  and the existing Daraz host; no tabs permission or extra stores were added.
- Ordinary headless Chromium synthetic smoke passed: narrow layout, closed Shadow
  DOM, manual opening, Escape/focus restoration, Continue shopping, uncancelled
  merchant button clicks, once-only automatic opening, no duplicate mount/analysis,
  stale response rejection after product navigation, analysis failure/missing price,
  safe untrusted title/owned-item text and observer/listener cleanup after revocation.
- The harness uses intercepted synthetic Daraz-shaped HTML, synthetic owned items
  and analysis/claim dependencies. The session-storage owner is covered by unit
  tests; this is not native extension installation/storage proof or a real purchase.
- Native extension/live Daraz cart/real variant checks remain unverified: managed
  Chromium blocks extension loading, live store access was previously denied, and
  real saved store fixtures are still absent. No order was placed.
- Save for later remains disabled with explicit unavailable text; the Phase 8
  cooling-off API/UI is not present. There is no fake save success.
- Phase 6 AI remains unconfigured/unverified as documented; no deployment occurred.

## Phase 8 — 10 November 2026
- Added three compact storage cases; full suite passed once: 9 files / 97 tests,
  zero failures/skips (~1.4 s). Typecheck and production build passed.
- Checks include each exact duration, Ready boundary/clamping, persistence across a
  repository module reload, absent price/image, concurrent saves, duplicate deadline
  preservation, variant/store/product identity, decisions/resave history, legacy
  record compatibility, revoked saves/decisions and deletion invalidation.
- Extended synthetic Chromium smoke passed: pending save disables controls, no early
  success, failed save retains duration and permits retry, exact acknowledged success,
  saved-list missing fields/links, Ready, Skip history, list clearing and cleanup.
- The shared test document closes the floating merchant panel before testing the list;
  production shows that list in a separate options page. Synthetic storage/decision
  responses are mocks, not evidence of native Chrome extension storage or restart.
- Native save→Chrome close/restart→Ready/delete verification remains UNRUN: the managed
  Chromium extension blocklist prevents installation. Automated module reload is not
  a substitute for a real Chrome restart. No live order or AI request was made.
- Decisions implemented; notifications, alarms, budgets and automatic purchase/owned
  item integration remain deferred. Time calculations use the device clock.

### Concurrent main merge validation
The incoming main branch contained committed unresolved source markers and alternate
notification/budget/wardrobe contracts. Exact conflicting source/test versions are
preserved in docs/merge-preservation; they are not active or claimed as passed.
Incoming fixtures, helper script, icon, package command and standalone insights module
were retained. After resolution, reran the active 97-test suite, typecheck and build;
all passed. Incoming raw fixture whitespace was preserved rather than reformatted.

<!-- phase6-accuracy:start -->
## Phase 6 measured accuracy — 2026-11-10T08:41:20.168Z

Keyword itemType: 3/4 (75.0%); category: 3/4 (75.0%).
AI accuracy unmeasured: PROXY_URL, EXTENSION_TOKEN and/or UNHAUL_ORIGIN absent.
AI failures/unavailable: 4/4; attempted: 0.
Median AI request time: unmeasured; slowest: unmeasured (includes failed attempts).

| Title | Keyword category/itemType | AI category/itemType or failure |
|---|---|---|
| 3 Piece - Printed Embroidered Suit - U3PE-NISHA26WV1-178 | clothing_accessories/dress_suit | unavailable (missing configuration) |
| Sensa Paper Cutter 613 | stationery/paper_cutter | unavailable (missing configuration) |
| Monochrome Theme Magnetic Notepads For Fridge | other/other | unavailable (missing configuration) |
| Barg - White & Turquoise Ceramic Mug | home_decor/mug | unavailable (missing configuration) |

Only four unchanged labels; not a general benchmark. Their referenced captures are absent from current fixtures. Missing imageUrl means text-only evaluation, not a vision benchmark. No labels edited.
<!-- phase6-accuracy:end -->

### Phase 6 gap validation
- Extension and proxy: `npx tsc --noEmit` passed.
- `npx vitest run tests/phase6.test.ts`: 8 tests passed (one new diagnostic).
- `npm run build` (extension): passed. Full suite intentionally not run.
- New synonyms from actual saved titles: sweater → outerwear (Bonanza, Zellbury),
  wallet → bag (Outfitters). No other synonyms or labels changed.
- Keyword miss retained: “Monochrome Theme Magnetic Notepads For Fridge” → other/other;
  expected stationery/notebook. No captured real title supports adding that plural
  in this task. Live AI requests: zero; timings and AI accuracy remain unmeasured.
## Submission checks (2026-11-10)
- `npm run stores:check` (team laptop, real Chrome): 15 Pakistani stationery, toy, gift and decor
  stores passed every check except robots.txt, which a checker bug (fixed in PR #5) misreported;
  they were added to `src/store/stores.ts`. Re-run after the fix to confirm. Failed and left out: alsimba.pk (DNS),
  babytoys.pk and giftkarte.com (no product link), toobas.pk (bot challenge), artsupplies.pk and
  fineartsmaterial.pk (product URLs are `/product/`, not `/products/`). A robots.txt wildcard bug
  marked almost every Shopify store BLOCKED in that first run.
- `npm run fixtures:check` (Chromium, offline): 5/5 saved fixtures PASS: URL in host_permissions and
  content matches, content script injected, reader returns title, price and PKR. The Beechtree
  fixture was removed because the saved page was the homepage.
- Visit recording: unit tests cover 30-minute dedupe, 30-day pruning and the consent requirement.
- `npm test`: all tests pass. `tsc --noEmit`: clean. Extension smoke test: PASS.
