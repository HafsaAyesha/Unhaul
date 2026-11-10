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
