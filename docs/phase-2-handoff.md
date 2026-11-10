# Phase 2 — extension scaffold handoff to A and B

## Ready for development
The existing WXT TypeScript project is retained; reinitializing it would overwrite
shared work. Vitest, storage permission, all three entrypoints and options UI exist.
The content script sends `{ type: 'PING' }`; the worker responds `{ type: 'PONG' }`.
Success is logged as `[Unhaul] PONG`; failures are logged separately.
Target: `www.daraz.pk`, product paths `/products/*` only. No wildcard subdomains.

- A: implement/verify the Daraz adapter and product extraction; do not use the
  existing Shopify placeholder for Daraz. Keep injection limited to product URLs.
- B: extend shared messages, classification and matching; preserve the PING handler.
- C: continue consent, storage, saved items and options UI.

## Manual check in the Unhaul test profile
1. Use an ordinary Chrome profile named Unhaul Test that permits unpacked extensions.
2. In `extension/`, run `npm ci` followed by `npm run dev`.
3. In that profile, open chrome://extensions, enable Developer mode, and load
   `extension/.output/chrome-mv3-dev` (not the parent folder).
4. Open a real Daraz Pakistan product URL starting `https://www.daraz.pk/products/`.
5. Open the page DevTools console, enable Info messages, and find `[Unhaul] PONG`.
6. Open extension options to verify the options entrypoint. Inspect the worker from
   chrome://extensions if the handshake fails. Reload the page after extension reload.
7. For release validation, run `npm run build` and repeat using `.output/chrome-mv3`.

WXT adds localhost, tabs and scripting access to development output for hot reload;
production output contains only the declared storage and Daraz permissions.

## Automated browser check
Run `npx playwright install chromium`, then `npm run build` and `npm run test:browser`.
For an installed test browser, set `CHROMIUM_PATH` to its executable.
The check uses a fresh temporary Unhaul test profile and a synthetic intercepted
Daraz product URL; it verifies real extension injection, PONG, options loading and
absence of injection on unsupported URLs. It does not test a live store.
With `npm run dev` running, use
`UNHAUL_BUILD_DIR=.output/chrome-mv3-dev npm run test:browser` to check dev output.

## Current environment limits
The managed Chromium blocks extension installation through its existing policy.
The fallback Playwright browser download is denied by network policy (403 from
cdn.playwright.dev). Live Daraz access is also denied (403 CONNECT).
No managed browser policy was changed. The browser smoke check has not passed;
Phase 2's browser acceptance criterion remains pending despite passing unit/build checks.
To finish here, allow the Playwright download/redirect domains and www.daraz.pk in
environment settings, or perform the manual steps on a Chrome profile that permits
unpacked extensions. No teammate notifications were sent outside this repository.
