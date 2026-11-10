# Unhaul context

This is the single source of truth for Unhaul's scope and decisions. Read it before you change scope, contracts or permissions, and give it to any AI assistant you use on this repo. If a decision changes, update this file in the same pull request and add a line to the decision log at the bottom.

Event: AI-Powered SE-MAX, CUI Tech Fest FA'26. Submission: final commit hash through the organizers' form by 3:00 PM.

## 1. What Unhaul is

A Chrome (Manifest V3) extension that gives shoppers a voluntary pause before an impulse buy, for any kind of product: stationery, decor, toys, electronics, clothing and more. On a supported store's product page it works out what the item is, checks whether the user already owns something that does the same job, and on Add to cart shows a small panel with similar owned items, one reflection question, and two buttons: **Save for later** and **Continue shopping**. Saved items go on a local cooling-off list with a countdown.

By default, Unhaul never freezes checkout, blocks payment, calls preventDefault on the store's buttons, or removes items from the store's cart. An Add to cart click is not proof of purchase. If the user explicitly enables the optional cooling-off lock, a matching saved product's Add to cart/Add to bag/Buy now click is held until its wait ends, with an Unlock anyway path.

## 2. Users

- Main: university students and young adults in Pakistan who shop online on a laptop, on a limited budget, and want to buy less on impulse.
- Second: the event judge, who must install Unhaul and finish the demo on their own browser in under 5 minutes, without our laptops.

## 3. Demo story (the finish line)

1. Install, then agree on the first-run consent screen.
2. Load sample items, and quick-add two of your own.
3. Open a product on a supported store. A badge shows similar owned items.
4. Click Add to cart. The store adds it as normal, and the Unhaul panel opens with matches, a reason and one question.
5. Save for later (24 h, 3 days or 7 days). The panel says: "Saved in Unhaul. This does not change the store's cart."
6. Restart Chrome. The item and countdown are still correct.
7. When the deadline passes, the item shows Ready. Mark it Skip or Purchased.

## 4. MVP features (all Must)

| ID | Feature |
|---|---|
| FR-01 | First-run consent screen; nothing runs on stores until the user agrees |
| FR-02 | Recognize product pages on the five tested stores with one generic reader |
| FR-03 | Read title, price, currency, image and product ID (see section 6) |
| FR-04 | Notice moves to another product without a page reload |
| FR-05 | Record product visits locally, deduplicated (same product within 30 min counts once) |
| FR-06 | Watch Add to cart clicks without blocking them |
| FR-07 | Load sample items with one click, with no duplicates on repeat clicks |
| FR-08 | Quick-add an owned item: name, category, item type, optional purpose and notes (text only) |
| FR-09 | List owned items; delete all Unhaul data |
| FR-10 | AI classification (category, item type, purpose) through the proxy |
| FR-11 | Keyword fallback when AI is slow, offline or invalid |
| FR-12 | Matching: item type first; category and purpose as support; up to 3 matches with a reason; no match on weak evidence |
| FR-13 | Badge on product pages; full panel on Add to cart; auto-opens at most once per product per session |
| FR-14 | Question chosen by rule (section 8) |
| FR-15 | Save for later: 24 h, 3 d or 7 d; absolute deadline; product snapshot |
| FR-16 | Cooling-off list: time left and Ready, correct after Chrome restart |
| FR-17 | Skip and Purchased buttons (Purchased is user-reported) |
| FR-18 | Optional cooling-off lock for matching saved products, off by default, with Unlock anyway |
| FR-19 | Let users enable one additional HTTPS store origin at a time through Chrome optional host permissions |

**Deferred, in this order:** notifications, pause-on-site and panel frequency settings, more stores, add Purchased items to My Items, optional budget and insights, save without timer, wider AI evaluation, smarter prompts and category-specific attributes.

**Not building:** checkout blocking, automatic purchase detection, mobile, other browsers, app-based shopping, photo uploads, accounts, cloud sync, an AI chatbot, reading salary or bank data.

## 5. Stores

- **Generic reader, no per-store code.** Runs on the built-in store list plus user-added HTTPS sites granted one at a time through optional permissions.
- Install-time host_permissions and content script matches list only built-in domains. Optional `https://*/*` access is requested per origin after a user click; **never `<all_urls>` at install.**
- The consent screen names the five stores.
- Daraz is the only non-Shopify store. If the reader can't get data from Daraz, drop Daraz and keep the other four.
- Adding a store = add its domain, a fixture and a test. No new reader code.
- The production build (`npx wxt zip`) is what ships. WXT's dev build adds tabs and scripting for hot reload; that's expected and not shipped.

## 6. Product reading

Read in this order, and leave a field empty (null) if no source has it. Never guess a price.

1. JSON-LD with `"@type":"Product"`
2. Open Graph tags (og:title, og:image, price tags)
3. Shopify product JSON at `/products/<handle>.js`

- Product page = JSON-LD Product data or Shopify product data is found.
- Product ID: Shopify uses origin + `/products/<handle>`. Daraz: digits after `-i` in the URL (not yet verified).
- Page changes: wrap history.pushState and listen to popstate; wait for the new product's data before reading.
- Add to cart: capture-phase listener on buttons or forms whose text or name matches add to cart, add to bag or buy now. Verify on each store.

**Fixtures:** 1–2 product pages per store across categories in `extension/tests/fixtures/`. Save with `copy(document.documentElement.outerHTML)` in a Guest window, not Ctrl+S. For Shopify, also save the `.js` response as `.json`. Before committing, search every file for token, csrf, session, @ and your own name. Record each file's data sources in `extension/tests/fixtures/README.md`.

## 7. AI

**Why AI is needed:** general stores sell thousands of kinds of items with messy titles ("Aesthetic Vintage Kraft Diary 200 Pages with Lock", "TWS Bluetooth 5.3 Earphones Pro"). Keyword rules miss most of them and can't tell that a diary and a journal serve the same purpose. A model reading the title and image can map almost any product to our fixed lists.

- **Model:** OpenAI gpt-4o-mini (text/image input confirmed from the official cookbook), called only through the proxy; live account/provider access remains unverified.
- **Sends:** only public product info: title, category text, image URL. Never owned items, visits or anything personal. The consent screen says this.
- **Returns:** JSON with category, itemType, purpose, confidence, all from section 9's lists.
- **Validation:** must parse; every value must be in the lists; confidence under 0.5 means Other / unknown; invalid replies fall back to keywords.
- **Fallback:** 3 s timeout, offline or invalid means keyword rules. The panel always still works.
- **Cache:** successful AI classifications use classifier/model-version + store/origin/product/variant keys and a 24-hour TTL. Temporary failures use uncached keywords and can retry.
- **Proxy:** Cloudflare Worker, `POST /classify`. Checks the optional extension token and explicit allowed extension origin, rejects bodies over 2 KB, about 30 requests per minute per IP, no body logging. Key stored with `wrangler secret`. Account spending caps are an operator responsibility, not verified by code.
- **Evaluation:** currently four hand-labelled titles in `extension/tests/labels.json`; the referenced captures are absent from the current fixture set. Report AI and keyword accuracy plus median and slowest AI time in docs/testing.md. Target: AI at least 80% on item type and at least 15 points above keywords. Report honestly if it misses.

### Current implementation and configuration
The active Cloudflare Worker POST /classify calls OpenAI gpt-4o-mini chat completions
with strict JSON schema. Only title, categoryText and imageUrl leave the extension;
owned items, notes, visits and saved lists are excluded. AI_API_KEY is set only with
`wrangler secret put AI_API_KEY`. EXTENSION_TOKEN is an optional abuse hurdle,
not a durable secret. PROXY_URL identifies the Worker. No provider key is embedded.

The proxy checks an explicitly allowlisted chrome-extension origin (declared and
actual origins must agree), JSON content type, the optional token and Cloudflare
rate binding (30/minute/IP). Bodies are capped at 2048 bytes with only those three
fields: nonempty title <=1024 characters, categoryText <=512, imageUrl null or an
approved/configured HTTPS CDN URL without credentials, fragment or nonstandard port.
Images reject redirects, cap bytes at 512 KiB and check JPEG/PNG/WebP signature/MIME;
validated bytes are sent as a low-detail data URL. Replies are bounded and validated
against category/type pairs, purposes and confidence. Confidence below 0.5 becomes
other/other/other; invalid output is rejected, not partially merged. Errors are
generic and request bodies/credentials are not logged. Upstream code is unchanged.

Keywords render immediately. Any proxy failure, offline, invalid reply or 3-second
extension timeout retains keywords; temporary failures are not permanently cached.
The Worker separately aborts image/upstream work after 2.5 seconds. Deployment,
operator spending caps and live accuracy remain unverified.

Configuration names: PROXY_URL and EXTENSION_TOKEN for extension/evaluation;
AI_API_KEY (secret), optional EXTENSION_TOKEN (secret), ALLOWED_ORIGINS, IMAGE_HOSTS
and CLASSIFY_RATE_LIMITER for the Worker. The accuracy CLI also needs UNHAUL_ORIGIN,
a real allowlisted extension origin; it must never fabricate an origin or read the
provider key. Run from extension with `npx tsx scripts/accuracy.ts`.


## 8. Matching and questions

- Same item type = strong match. Same category and same purpose = weak match. Different purpose = never a match (a charger and headphones don't match).
- Return up to 3, strongest first, each with a reason like "Same type: notebook". Weak evidence only = no match.
- Keyword rules: lowercase, **whole-word matching only**, longest phrases first (so "power bank" beats "bank", and "pen" never matches "open").

Question order:

| Situation | Question |
|---|---|
| Matching owned item | "What would this add beyond what you already own?" |
| Discount shown (wasPrice present) | "Would you still want this at full price?" |
| Repeat visit | "What need would this purchase meet?" |
| No reliable match | "Would you still want this after three days?" |

## 9. Shared contracts (src/shared/)

These files are owned by B. After merge, **adding an optional field is fine; renaming or removing a field needs the whole team told first.**

- `lists.ts`: CATEGORIES, ITEM_TYPES, PURPOSES, DEFAULT_PURPOSE, SYNONYMS, LABELS, WAITS. Code uses lowercase underscore IDs; display names live in LABELS.
- Categories: stationery, home_decor, toys_games, electronics, clothing_accessories, other.
- Purposes: writing, organizing, decoration, lighting, personal_audio, charging, play, wearing, carrying, other.
- Item types: start from the brief's list, plus mug and paper_cutter. Add more only by updating lists.ts.
- `types.ts`: Product (price and wasPrice are `number | null`), Classification, OwnedItem (source sample or manual), SavedItem (unique save-record ID, stable store/product/variant identity for deduplication, absolute reconsiderAt and legacy-compatible deadline, status waiting/skipped/purchased; Ready is never stored), Visit, Settings (schemaVersion 1, consentGiven), Match.
- `messages.ts`: PING to PONG; GET_CONSENT to {consentGiven: boolean}; PRODUCT_SEEN to MATCH_RESULT; ADD_TO_CART_CLICKED to OK; SAVE_ITEM to SAVE_RESULT (saved or already_saved, with deadline).
- `examples.ts`: made-up example records for building and tests.
- Storage keys (`src/storage/keys.ts`): unhaul:settings, unhaul:items, unhaul:saved, unhaul:visits, unhaul:classification-cache. These names follow the explicit storage tasks.
- Active storage API: initializeStorage, getSettings, setConsent, getItems, addItem, deleteItem, loadSampleItems, getSavedItems, setSavedItems, getVisits, setVisits, getClassificationCache, setClassificationCache, deleteAllUnhaulData. Background owns the repository; options/content use the typed client. Snapshot setters replace collections and are not atomic incremental updates.

## 10. Privacy and security

- Owned items, visits and the saved list stay in chrome.storage.local. Verified with the Network tab during the demo.
- Only public product info goes to the proxy.
- No keys, tokens or passwords in the repo or its history. `.env` is git-ignored; `.env.example` lists PROXY_URL and EXTENSION_TOKEN with no values. The API key exists only as a Cloudflare secret.
- All sample data and fixtures are made up or scrubbed. No real personal data.
- Delete all data clears every `unhaul:` key and the classification cache.
- The optional cooling-off lock is stored in existing settings; content scripts receive only a yes/no lock result for the current product, never the saved list.
- User-added sites are derived from Chrome's granted origins; Unhaul reads only product pages on those origins and never stores the permission list.

## 11. Targets (NFRs)

| ID | Target |
|---|---|
| NFR-01 | Badge within 1.5 s of page load (10 pages) |
| NFR-02 | AI median under 2 s; give up at 3 s |
| NFR-03 | AI item type accuracy at least 80%, and 15 points above keywords |
| NFR-04 | Panel shows every time with the proxy off |
| NFR-05 | 5 quick-adds in under 60 s |
| NFR-06 | Judge finishes the demo in under 5 min on a fresh browser |
| NFR-07 | 0 requests carrying owned items or history |
| NFR-08 | Add to cart works 10/10 when the lock is off or the product isn't cooling off |

Report measured results only. Mark each feature implemented, deferred or unverified.

## 12. Team and working rules

| Teammate | Owns | Docs |
|---|---|---|
| A | Fixtures, product reader, visits, Add to cart watching, badge, panel | testing.md |
| B | Shared contracts, keywords, AI proxy and validation, matching, questions, labels and accuracy run | design.md, AI part of requirements.md |
| C | Scaffold, storage, consent, My Items, cooling-off list, release ZIP | README.md, requirements.md, SUBMISSION.md, .env.example |

- Branches a-store, b-brain, c-app; merge to main through pull requests, at least hourly.
- No force-pushes, no history rewrites.
- Log every meaningful AI use in docs/ai-usage-log.md as it happens.
- Write docs throughout the day, not at the end.
- If behind, cut in this order: visual polish, repeat-visit question, panel opening limit. Never cut save and reconsider, the AI fallback, tests or docs.

## 13. Deliverables

README.md, docs/requirements.md, docs/design.md, docs/testing.md, docs/ai-usage-log.md, docs/judge-checks.md (list still needed from the organizers), SUBMISSION.md, .env.example, a GitHub Release with the extension ZIP, and a 90-second demo video linked in the README. No test accounts are needed because there is no login.

Judge install: download the ZIP from the Release, unzip, chrome://extensions, Developer mode, Load unpacked, agree to consent, load sample items, open the product links in the README.

## 14. Status and open items

- Phase 2 (scaffold): done. Build, typecheck and tests pass. Live PONG on a real product page still to be checked in a real Chrome.
- Phase 3 (contracts): files written; needs tsc, build, merge to main and the 3-minute review with A and C.
- Phase 1 (fixtures): Shopify stores tested by hand; Daraz still to be checked; fixture files and README table still to be committed.
- `readProduct()` must be mapped to the shared Product type (A).
- judge-checks.md list from the organizers.
- Team name.

## 15. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-11-10 | Product uses AI for classification, with a keyword fallback | Event is AI-powered; AI must be meaningful and measured against a baseline |
| 2026-11-10 | General products, not clothing only | Impulse buying covers stationery, decor, toys and tech too |
| 2026-11-10 | 4–5 hour MVP: save and reconsider flow; budget, insights and notifications deferred | Fits the time with three people |
| 2026-11-10 | Quick-add, Skip, Purchased and consent are Must | Judges test with their own items; saved items need an ending; tracking needs permission |
| 2026-11-10 | Generic reader on 5 tested stores, no `<all_urls>` | Same reader works across Shopify stores; fixed list keeps permissions and consent narrow |
| 2026-11-10 | Install via GitHub Release ZIP, not the Chrome Web Store | Store review can take days |
| 2026-11-10 | AI key only in a Cloudflare Worker proxy | A key inside an extension can be read by anyone |
| 2026-11-10 | Optional cooling-off lock, off by default, with Unlock anyway | Users asked for a firmer commitment device; opt-in keeps it voluntary |
| 2026-11-10 | Users can add stores one at a time via optional host permissions | Generic reader works beyond the 21 stores; Chrome's prompt keeps it opt-in |
| 2026-11-10 | Use `unhaul:items` and `unhaul:classification-cache`; initialize version-1 settings with consentGiven false only when absent | Explicit storage-initialization request; preserve existing consent and safely migrate legacy `items` without data loss |
| 2026-11-10 | Background exclusively owns active extension storage; validated typed client messages and one operation queue; migration prefers namespaced IDs | Explicit storage-wrapper request; prevents lost read-modify-write updates and preserves existing user records |
| 2026-11-10 | Install-only onboarding and options gating use persisted explicit consent; deletion returns to consent | User requested installation consent phase; product observation and content-script consent enforcement remain separate |
| 2026-11-10 | Consent gate fails closed in content and background; revocation invalidates async work across deletion/re-agreement | Requested Phase 4; unfinished product operations return explicit errors and must use the documented scope/commit guard |
| 2026-11-10 | Ten fictional samples use sample-01 through sample-10; add cap to the existing taxonomy | Requested Phase 5; two samples per category, preserve loader and user data; fixture alignment remains pending |
| 2026-11-10 | Phase 6 uses optional gpt-4o-mini vision via Worker, immediate basic plus separate refinement, versioned AI-only cache | Official modality verified; live credentials/deployment unavailable. Purpose conflicts excluded; UI/product-reader integration remains separate |
| 2026-11-10 | Phase 7 connects structured Daraz metadata to a consent-bound reflection UI; automatic opening markers use background storage.session per tab/product | Reader was empty; no extra stores or permissions added. Saving is explicitly disabled until Phase 8; synthetic browser verification only |
| 2026-11-10 | Phase 8 stores absolute reconsiderAt/deadline, deduplicates active store/product/variant saves, and preserves decided history on resave | User requested cooling-off flow; Skip/Purchased are self-reported and immutable. Native Chrome restart still needs independent verification |
| 2026-11-10 | Store list moved to `src/store/stores.ts` (feeds host_permissions, content matches and the reader); fixture stores added; reader accepts JSON-LD ProductGroup | Requested so saved fixtures are recognized by Chrome; `stores:check` vets new Pakistani stores before adding |

| 2026-11-10 | Phase 6 gap review adds only fixture-title sweater/wallet synonyms; retains used matchItems; records four-label accuracy without label edits | Preserve active contracts and expose weak results rather than claiming unmeasured AI accuracy |
