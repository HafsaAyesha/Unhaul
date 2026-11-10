# Judge checks
The organizers' criteria list was not provided to the team, so this table follows the SUBMISSION.md checklist from the event template. Status is honest as of the release commit.

| Check | Where we meet it | Status |
| --- | --- | --- |
| Product is deployed and reachable without our laptops | GitHub Release ZIP (link in README "Live deployment"); loads as an unpacked Chrome extension | Pending: release not created yet |
| README judge quick start tested on a fresh browser | README "Judge quick start" | Pending: fresh-profile run not done yet |
| Test accounts listed and working | README "Test accounts": none needed, no login | Met |
| All tests pass | docs/testing.md "Current status"; `npm test` | Met (unit tests); by-hand checks pending |
| docs/requirements.md completed | FR-01 to FR-17 and NFR-01 to NFR-08 tables | Met; most NFRs marked not measured |
| docs/design.md completed | Architecture, storage, consent, AI contract, panel, cooling-off, build notes | Met |
| docs/testing.md completed | Current status, edge cases, accuracy run, store and fixture checks | Met; AI accuracy not measured |
| docs/ai-usage-log.md completed | docs/ai-usage-log.md | Met (team to add final entries) |
| docs/judge-checks.md completed | This file | Met |
| No passwords, API keys or tokens in repo or history | Keys only as Wrangler secrets; `.env` git-ignored; history searched (docs/testing.md) | Met |
| No real personal data in repo or demo | Fictional sample items; fixtures saved in a fresh browser and redacted | Met |
| No force-pushes or history rewrites | All changes merged through pull requests | Met |
| Meaningful AI use, with a fallback | src/classify (AI via proxy, keyword fallback); proxy/README.md; design.md AI contract | Implemented; live AI unverified (no proxy deployed) |
| Privacy | Only public product info goes to AI; owned items, visits and saved list stay local (design.md, README limitations) | Met by code review; Network tab check pending |
