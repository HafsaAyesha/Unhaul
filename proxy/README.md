# AI proxy (B)
Run `npm ci`, `npm run typecheck`, `npm run build`, then `npm run dev`.
`GET /health` reports availability; classification deliberately returns 503.
Before deploying, implement input/output validation, request limits, rate limiting,
timeouts, permitted extension origins/CORS and a provider integration.
Store the provider key with `npx wrangler secret put AI_API_KEY`.
Never put secrets in the extension. Do not deploy this scaffold as a working AI service.
