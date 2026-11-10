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
