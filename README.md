# Unhaul

> AI-Powered SE-MAX · CUI Tech Fest FA'26 · Team: TBD (fill in)

## What it does

Unhaul is a Chrome extension that gives you a short, voluntary pause before an impulse buy. On a supported store's product page it shows which things you already own are similar, asks one reflective question, and lets you save the product for 24 hours, 3 days or 7 days before deciding. It works across product types: stationery, home décor, toys, electronics, clothing and accessories.

## Problem and user

The user is an online shopper in Pakistan who often buys things they already have, or regrets a purchase a few days later. Store pages are built to make buying fast. Unhaul adds a moment to reflect at the point of Add to cart, without blocking checkout or changing the store's cart.

## Live deployment

- **URL / install link:** https://github.com/HafsaAyesha/Unhaul/releases/tag/v1.0.0
- **Platform:** Google Chrome (desktop), loaded as an unpacked Manifest V3 extension

## Judge quick start (under 5 minutes)

1. Download `unhaul-extension-0.1.0-chrome.zip` from the release link above and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder. The Unhaul consent page opens.
4. Click **Agree and enable Unhaul**, then **Load sample items**. Optionally quick-add one of your own items.
5. Open one of the product links below. A small Unhaul badge appears at the bottom right.
6. Click the store's **Add to cart**. The store adds the item as normal, and the Unhaul panel opens with similar items you own and a question.
7. Choose a wait and click **Save for later**. Open the extension's options page (right-click the Unhaul icon, then **Options**) to see the cooling-off list, the time left, and the Skip and Purchased buttons.

Product pages that pass the saved-page check (`npm run fixtures:check`):

- https://outfitters.com.pk/products/f0283-113
- https://zellbury.com/products/mock-neck-zipper-sweater-1005
- https://junaidjamshed.com/products/matt-black-plain-peshawari-sandals-jpc21363gkpln
- https://crossstitch.pk/products/espresso-dream-rts
- https://bonanzasatrangi.com/products/c-bean-turtle-neck-zipper-full-sleeves-sweater-753-13

Any product page (a URL containing `/products/`) on these supported stores also works. Each passed the live store check (`npm run stores:check`) on 2026-11-10:

| Category | Stores |
|---|---|
| Stationery | stationers.pk, thestationerycompany.pk, rung.com.pk, theschoolstore.pk, saleemibookdepot.com |
| Toys | toycompany.pk, toynix.pk, odeez.pk, babybazar.pk |
| Gifts and décor | zubaidas.com, chasevalue.pk, designyourown.pk, blingspot.pk, soz.com.pk |
| Clothing and home | nishatlinen.com, bonanzasatrangi.com, crossstitch.pk, junaidjamshed.com, outfitters.com.pk, zellbury.com |
| General | daraz.pk |

The single store list is `extension/src/store/stores.ts`. It feeds the manifest's host permissions, the content script matches and the product reader. Unhaul never requests access to all sites.

## Test accounts

No test accounts needed: Unhaul has no login.

## Run locally

### Prerequisites

- Node.js 22.12 or newer, and npm
- Google Chrome
- For the AI proxy only: a Cloudflare account and Wrangler (installed by `npm ci` in `proxy/`)

### Setup

```sh
cd extension
npm ci
```

### Environment variables

Names only. Put values in a local `.env` file, which is git-ignored (see `.env.example`).

- Extension build: `PROXY_URL`, `EXTENSION_TOKEN`
- Proxy (Wrangler secrets, never in the repo): `AI_API_KEY`, `EXTENSION_TOKEN`

Without `PROXY_URL` the extension uses keyword matching only, and everything else works the same.

### Run

```sh
cd extension
npm run build        # production build in .output/chrome-mv3
npm run zip          # release ZIP in .output/
```

Load `extension/.output/chrome-mv3` with **Load unpacked** in `chrome://extensions`. To develop with reload, run `npm run dev` and load `.output/chrome-mv3-dev`.

AI proxy (optional):

```sh
cd proxy
npm ci
npx wrangler secret put AI_API_KEY
npx wrangler secret put EXTENSION_TOKEN
npx wrangler deploy
```

`ALLOWED_ORIGINS` in `proxy/wrangler.toml` is already set to the extension's fixed ID (`chrome-extension://poclfboelhiknbalppadihkdciclhlha`, pinned by the public `key` in `wxt.config.ts`). Then build the extension with the proxy URL: `PROXY_URL=https://<your-worker>.workers.dev EXTENSION_TOKEN=<same token> npm run zip`. See `proxy/README.md` for details.

### Run tests

```sh
cd extension
npm run typecheck
npm test               # unit tests (Vitest)
npm run fixtures:check # loads the built extension in Chromium against saved store pages
npm run stores:check   # checks candidate stores live
```

In `proxy/`: `npx tsc --noEmit`.

## Known limitations

- Chrome on desktop only.
- Runs only on the listed stores, and only on product pages whose URL contains `/products/`.
- Purchased is self-reported. Unhaul does not detect or verify purchases.
- When AI is enabled, the public product title, category text and image URL are sent through our proxy to OpenAI (gpt-4o-mini) for classification. Owned items, visits and the saved list never leave the browser.
- AI accuracy has not been measured yet. The last run had no proxy configured (see docs/testing.md), and this release ZIP is built without `PROXY_URL`, so it uses keyword matching.
- There are no reminders or notifications. Open the options page to see when an item is ready.
- Time left uses the device clock.

## Documentation

- [Requirements](docs/requirements.md)
- [Design](docs/design.md) (includes the older per-phase build notes)
- [Testing](docs/testing.md)
- [AI usage log](docs/ai-usage-log.md)
- [Judge checks](docs/judge-checks.md)
- [Project context](context.md)

## Team

| Name | Role |
|------|------|
| Hafsa Ayesa (A) | Store pages: product reader, visits, Add to cart watching, badge and panel, fixtures |
| Amna Farooq (B) | AI and matching: shared contracts, keywords, AI proxy, matching, questions, accuracy |
| Ummara Amin (C) | App and data: storage, consent, My Items, cooling-off list, release ZIP |
