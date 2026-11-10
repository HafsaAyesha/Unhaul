# Unhaul
A Chrome extension that helps users reconsider impulse purchases across categories:
stationery, home décor, toys, electronics, clothing and more.

## Status
Development scaffold, not a completed MVP. Sample-item loading, deletion, keyword
classification and basic matching exist. Store extraction, consent enforcement,
reflection integration, saving/timers and AI classification remain to be built.
Daraz Pakistan is the Phase 2 target. Production host access is restricted to
`https://www.daraz.pk/*`, with content injection only on `/products/*`.
The content script performs a PING/PONG connectivity check only.
Live store extraction is not verified.
No product tracking or external AI calls are currently enabled.

## Development
Use the existing checkout; no extra worktree is needed. Node.js 22.12+ recommended.

```sh
cd extension
npm ci
npm run dev
# Manually load .output/chrome-mv3-dev in your Unhaul test profile.
# In another terminal, or after stopping dev:
npm run typecheck
npm test
npm run build
npm run zip
```

In managed environments with a read-only home directory, pass
`--cache /workspace/.npm-cache` to `npm ci`. For Wrangler, use
`XDG_CONFIG_HOME=/workspace/.unhaul-config WRANGLER_SEND_METRICS=false`
before its npm commands. These paths are outside the checkout.

Load `extension/.output/chrome-mv3` through Chrome → Extensions → Developer mode
→ Load unpacked after a production build. Open the extension's options page to
load fictional sample items or delete local data. See `proxy/README.md` for the worker.

## MVP scope
One verified shopping website with multiple categories; My Items; product extraction;
matching; a reflection panel; Save for later; a persistent cooling-off list.
Checkout is never blocked. Saving must not change the merchant's cart.
Keep owned items and visit history local. If AI is enabled later, disclose the public
product information transmitted to the proxy/provider.

## Ownership
- A: store adapters, content script, badge, panel, product fixtures.
- B: shared contracts, classification, AI proxy, matching, labelled evaluation.
- C: storage, consent/options page, cooling-off list, packaging and documentation.

See `docs/phase-2-handoff.md` for the PING/PONG walkthrough and A/B handoff.
See `docs/requirements.md` for implementation status and `SUBMISSION.md` for handoff.

## Planned proxy settings
Copy the root `.env.example` to `.env` when needed. `PROXY_URL` and `EXTENSION_TOKEN`
are reserved for later integration and are not read or bundled by this phase.
An extension-distributed token cannot be treated as a durable secret.
