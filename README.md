# Unhaul
A Chrome extension that helps users reconsider impulse purchases across categories:
stationery, home décor, toys, electronics, clothing and more.

## Status
Development scaffold, not a completed MVP. Sample-item loading, deletion, keyword
classification and basic matching exist. Store extraction, consent enforcement,
reflection integration, saving/timers and AI classification remain to be built.
No store is verified. Content-script access is restricted to localhost for development.
No website tracking or external AI calls are currently enabled.

## Development
Use the existing checkout; no extra worktree is needed. Node.js 22.12+ recommended.

```sh
cd extension
npm ci
npm run dev
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

See `docs/requirements.md` for implementation status and `SUBMISSION.md` for handoff.
