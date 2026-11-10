# Submission checklist
- Team name: TBD (fill in)
- Repository: https://github.com/HafsaAyesha/Unhaul
- Final commit: TBD at submission (`git rev-parse HEAD` on main)
- Release ZIP: build with `cd extension && npm run zip`, attach `.output/unhaul-*-chrome.zip` to a GitHub Release
- Demo video: TBD (90 seconds, link here and in README)
- Supported stores: 21, listed in README and `extension/src/store/stores.ts`; each passed `npm run stores:check`
- Fixture check: `npm run fixtures:check` (all saved fixtures PASS)
- Unit tests: `npm test`; typecheck: `npm run typecheck`
- AI proxy: deployed? TBD. Without it the keyword fallback runs.
- Fresh-profile judge walkthrough: TBD (follow README "Install (judges)")
- No test accounts are needed; there is no login.

Before handoff: run the checks above, search fixtures for token/csrf/session/@ and personal names,
and send the final commit hash through the organizers' form by 3:00 PM.
