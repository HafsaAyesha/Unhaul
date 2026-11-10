# Testing
From `extension/`: `npm run typecheck`, `npm test`, `npm run build`.
From `proxy/`: `npm run typecheck`, `npm run build`.

The unit suite checks cross-category exclusion, unknown-item behavior and malformed
classification rejection. Real store fixtures and labelled evaluation are not yet added;
`labels.json` is intentionally empty and is not an evaluation result.

Pending functional checks: load unpacked in fresh Chrome profile; sample load twice;
delete all; supported-store extraction/navigation; merchant Add to cart; reflection
buttons; saved-item deduplication; restart/overdue handling; AI timeout and privacy.
No end-to-end readiness or AI accuracy claim is made by this scaffold.

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
