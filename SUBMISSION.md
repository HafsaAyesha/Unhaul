# Submission Checklist

Complete before 3:00 PM. Submit your final commit hash through the organizers' form.

## Submission details

- **Team name:** Cat-astrophe 🐱
- **Repository URL:** https://github.com/HafsaAyesha/Unhaul
- **Final commit hash:** 87a6752 (HEAD -> main, origin/main, origin/HEAD) 
- **Live URL / install link:** https://github.com/HafsaAyesha/Unhaul/releases/tag/v1.0.0 (asset: `unhaul-extension-0.1.0-chrome.zip`)
- **Submitted at (time):** 4:00 pm (10th November,2026) 

## Checklist

- [x] Product is deployed and reachable without our laptops (GitHub Release v1.0.0)
- [ ] README judge quick start tested by a team member on a fresh device or browser
- [x] Test accounts listed in README and working (none needed: Unhaul has no login)
- [x] All tests pass (see docs/testing.md)
- [x] docs/requirements.md completed
- [x] docs/design.md completed
- [x] docs/testing.md completed
- [ ] docs/ai-usage-log.md completed (team to add the final entries)
- [x] docs/judge-checks.md completed with a pointer for every check
- [x] No passwords, API keys or tokens in the repository or its history (searched 2026-11-10)
- [x] No real personal data in the repository, database or demo
- [x] No force-pushes or history rewrites

2. `cd extension && npm run zip`, then create the release:
   `gh release create v1.0.0 extension/.output/unhaul-extension-0.1.0-chrome.zip --title "Unhaul v1.0.0" --notes "Event build"`
3. Put the release link in README "Live deployment" and above.
4. One teammate loads the ZIP in a fresh Chrome profile and follows the README quick start.
5. Record the 90-second demo video and link it in README.
6. Copy the final commit hash from main here and into the organizers' form before 3:00 PM.
