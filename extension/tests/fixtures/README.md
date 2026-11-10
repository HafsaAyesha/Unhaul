# Product fixtures
Saved product pages (and Shopify `.js` responses as `.json`) used to check the product reader offline.
Do not commit cookies, account details, session identifiers or personal information.

## Commands (run in `extension/`)
- `npm run stores:check` vets candidate Pakistani stores live (bot blocking, login walls, robots.txt, product data, reader). Saves nothing.
- `npm run fixtures:auto -- <category>:<domain>` saves product pages from a store into this folder.
- `npm run fixtures:check` builds the extension and, offline in Chromium, checks every fixture here: its URL is in
  `host_permissions` and the content script `matches`, Chrome injects the content script, and `src/store/extract.ts`
  reads title, price and currency. First time only: `npx playwright install chromium`.

A store runs live only after its domain is in `STORE_DOMAINS` in `src/store/stores.ts` (that list feeds the manifest,
the content script matches and the reader). Also add its name to the consent text in `entrypoints/options/index.html`.

## Current fixtures (`npm run fixtures:check`, 2026-11-10)
| File | Source URL | Data | Result |
|---|---|---|---|
| bonanzasatrangi-com-c-bean-turtle-neck-zipper-full-sleeves-sweater-753 | https://bonanzasatrangi.com/products/c-bean-turtle-neck-zipper-full-sleeves-sweater-753-13 | JSON-LD Product, OG, .js | PASS |
| crossstitch-pk-espresso-dream-rts | https://crossstitch.pk/products/espresso-dream-rts | JSON-LD Product, OG, .js | PASS |
| junaidjamshed-com-matt-black-plain-peshawari-sandals-jpc21363gkpln | https://www.junaidjamshed.com/products/matt-black-plain-peshawari-sandals-jpc21363gkpln | JSON-LD ProductGroup, OG, .js | PASS |
| outfitters-com-pk-f0283-113 | https://outfitters.com.pk/products/f0283-113 | JSON-LD ProductGroup, OG, .js | PASS |
| zellbury-com-mock-neck-zipper-sweater-1005 | https://zellbury.com/products/mock-neck-zipper-sweater-1005 | JSON-LD ProductGroup, OG, .js | PASS |
| beechtree-pk-bt12603un004720-green | (page saved is the homepage: og:url is https://beechtree.pk/) | none | FAIL: re-save or delete |
