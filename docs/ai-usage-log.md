# AI usage log
| Date | Assistance | Retained | Verification |
| --- | --- | --- | --- |
| 2026-11-10 | User requested repository scaffold for the agreed general-shopping scope | WXT structure, interfaces, starter helpers, proxy skeleton and documentation | Build/typecheck/unit-test results in testing.md; functional integration pending |

Append meaningful AI use throughout implementation. Do not include credentials or
personal data. Record what changed and how outputs were checked.

## Phase 2 implementation — 2026-11-10
AI assistance added scoped Daraz permissions, PING/PONG entrypoints, runtime message
guards, connectivity tests, browser smoke script and handoff instructions.
Validation results and browser-policy limitations are recorded in testing.md.

## Storage initialization implementation — 2026-11-10
AI assistance implemented namespaced keys, version-1 consent defaults, lifecycle
initialization, safe legacy-item migration, and focused storage/lifecycle tests.
Changes were checked with the existing tests, TypeScript and production build;
Chrome lifecycle behavior was not manually verified in this task.

## Storage wrapper — 2026-11-10
AI assistance implemented the typed repository, runtime record/message validation,
background-owned queue and dispatcher, typed client, existing options-action wiring,
legacy preference policy and focused concurrency/transport tests. Root-level contract
drafts were preserved. Validation outcomes are in testing.md; browser UI was not
manually verified in this task.

## Installation consent — 2026-11-10
AI assistance added install-only options opening, consent markup, a testable options
controller, loading/error/retry and agreement/revocation handling, plus focused
lifecycle/controller tests. Copy was checked against inactive observation/AI code.
No product tracking or permissions were added. Native Chrome checks were unrun;
results are recorded in testing.md.

## Consent enforcement — 2026-11-10
AI assistance added consent contracts, background denial/unfinished-operation
responses, content lifecycle cleanup/timeout, and queued consent/generation guards.
Focused tests cover failure, revocation, late results, re-agreement and deletion.
Existing browser smoke instructions were updated; native browser checks remain
unrun under the managed extension blocklist. Results are in testing.md.

## Sample data expansion — 2026-11-10
AI assistance expanded fictional samples to ten stable IDs across five categories,
added the missing cap taxonomy entry/default purpose/label, updated the existing
journal-ID assertion, and added one focused data-validation test. No sample-loading
or migration behavior changed. Real-fixture alignment remains pending because the
fixtures directory contains only a README. Legacy-ID coexistence is documented.

## Phase 6 — 2026-11-10
AI assistance implemented title-first rules, explained/ranked matching, consent-aware
basic/refinement analysis, atomic versioned caching, optional build configuration and
the image-capable OpenAI proxy. Official OpenAI cookbook checked for model modality.
A compact focused test file plus two existing integration cases use synthetic inputs
and mocked provider responses. Results are in testing.md. No credentials were read,
no live provider call/deployment occurred, and no commit/push was made for this task.

## Phase 7 — 2026-11-10
AI assistance implemented reflection UI, a minimum structured reader to replace the
empty extractor, guarded per-tab opening markers and existing-history prompt selection.
Added two focused cases plus a synthetic Chromium UI harness; no new dependencies.
The previous uncommitted Phase 6 work is included for the user-authorized main push.
Saving is explicitly unavailable, and live merchant/native extension/AI behavior is
not claimed. Verification details are in testing.md.

## Phase 8 — 2026-11-10
AI assistance implemented atomic save/decision APIs, typed transport, compatible
absolute deadlines, panel duration/error/acknowledgement UI, and the options list.
Added three compact storage cases and extended the existing synthetic UI harness.
Checks and the native browser restriction are recorded in testing.md. No provider
call, order, deployment or new dependency was introduced. User authorized the main push.

Phase 8 push required merging concurrent main changes. Kept incoming fixtures/helper
files, preserved exact incompatible draft sources in docs/merge-preservation, and
retained the tested active consent/storage contracts without notification permissions.
Revalidated the merged active code; no history rewrite or source archive loss.

## Phase 6 gap review — 2026-11-10
AI assistance added fixture-backed sweater → outerwear and wallet → bag synonyms,
retained matchItems because core.test.ts uses it, corrected AI documentation and
added an unchanged-label diagnostic and accuracy CLI. No upstream/provider changes,
labels edited or credentials added. Measured results are in testing.md.
2026-11-10 (Claude Code): wrote `stores:check` (vets Pakistani stores) and `fixtures:check` (offline
Chromium fixture check), moved the store list to `src/store/stores.ts`, added the 15 stores that passed,
let the reader accept JSON-LD ProductGroup, implemented visit recording and the Add to cart reply,
and refreshed README/requirements/testing/SUBMISSION. Checked with unit tests, tsc, fixtures:check
and the smoke test; the live store run was done by the team on their own laptop.

## Release prep — 2026-11-10 (Claude Code)
Fixed final display gaps (PR #10: PKR price formatter, badge wording, Basic matching label, countdown
wording, saved-list layout) with 2 new unit tests. Rewrote README under the template headings, moved the
per-phase build notes into design.md, added the NFR table to requirements.md, a current-status and
edge-case table to testing.md, filled judge-checks.md and SUBMISSION.md, ran `npx wxt zip` and inspected
the ZIP (storage only, 21 store domains, no secrets). Searched tracked files and full git history for keys:
no hits. The team reviewed and merged the pull requests.

## Dashboard — 2026-11-10
Copilot generated the read-only options dashboard and focused aggregation tests; typecheck, unit tests and build were run.
Copilot was used to polish the reflection panel and badge styling; existing UI tests and extension checks were rerun.
Copilot was used to build the tab-based options app shell, hash router, Home journey and Settings view; typecheck, tests and production manifest checks were run.
Copilot implemented the opt-in cooling-off lock, background yes/no checks, locked panel flow and focused tests; typecheck, tests and build were run.
Copilot added one-origin-at-a-time optional host permissions, dynamic custom-site content scripts, toolbar routing and settings controls; origin tests, typecheck and a production build were run.
Copilot made the existing cooling-off lock strict and on by default, added the Unhaul-page-only early-end flow, pending capture handling and focused storage tests; typecheck, tests and build were rerun.
