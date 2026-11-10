# Unhaul classification proxy

## Implemented
`POST /classify` accepts only `{title, categoryText, imageUrl}` (imageUrl may be null)
in a maximum 2 KiB JSON body. It calls OpenAI's image-capable `gpt-4o-mini` using
structured output. Shared taxonomy and output validation are imported from the
extension, so category/type lists do not diverge.

The extension waits at most 3 seconds and falls back to local keywords. The Worker
limits image/provider work to 2.5 seconds. Invalid/failed responses never expose
provider error bodies. There is no request-body, authorization or credential logging.

## Configuration before an authorized deployment
1. Install with `npm ci`. Run `npm run typecheck` and `npm run build` (dry-run only).
2. Set `AI_API_KEY` using `npx wrangler secret put AI_API_KEY`. Never put its value
   in the repository or extension. The implementation uses a fixed provider endpoint
   and model; no arbitrary upstream URL or model is accepted from clients.
3. Set ALLOWED_ORIGINS in wrangler.toml to the actual extension origins, for example
   `chrome-extension://<your 32-character a-p extension ID>`. No wildcard. Determine
   the ID from the intended unpacked/release build; it may differ by profile/path.
4. Narrow IMAGE_HOSTS to needed CDN hosts. Supported approved destinations are
   cdn.shopify.com, img.drz.lazcdn.com, and static-01.daraz.pk. Unknown/other hosts
   fail closed. These are image CDN destinations, not additional supported stores.
5. Preserve the CLASSIFY_RATE_LIMITER binding (30 requests/60 seconds per IP).
   Choose an appropriate namespace for your Cloudflare account. Cloudflare's binding
   enforces approximate limits per location, not an account-wide global quota.
6. An optional EXTENSION_TOKEN can be stored as a Worker secret and supplied in
   the extension build. It is merely an abuse hurdle: users can extract anything
   distributed in an extension. Rate limiting, narrow inputs and provider spending
   controls remain necessary. Configure an account spending limit separately.
7. Deployment is a separate authorized action; this task did not deploy anything.

The runtime requires Cloudflare's trusted CF-Connecting-IP and the rate-limit binding;
it returns 503 rather than running without limits. Allowed origins/CORS and the
X-Unhaul-Origin fallback identify permitted clients for browser access, not strong
authentication: non-browser callers can spoof origins and public extension tokens.

## Image handling
Only HTTPS URLs on the fixed approved CDN list AND configured subset are fetched.
Credentials, unusual ports and fragments are rejected. All redirects are rejected;
no Location is followed. Streaming image reads stop at 512 KiB and require matching
JPEG/PNG/WebP signatures and MIME types. Only base64 image bytes, never a remote
image URL, reach the model. The provider therefore cannot be instructed to fetch an
arbitrary destination. Unavailable, oversized or unsupported images cause fallback.

## Extension build
Supply PROXY_URL as an HTTPS origin to the extension build process:

```sh
cd extension
PROXY_URL=https://your-worker.example npm run build
```

EXTENSION_TOKEN is optional and public once bundled. Root .env.example lists names;
WXT configuration reads these process variables, not a custom root dotenv file.
Only the configured proxy origin is added to host_permissions. With no PROXY_URL,
AI is disabled, no extra proxy permission is requested, and keyword analysis works.
Rebuild after changing the URL/token. No provider API key belongs in these settings.

## Verification and limitations
Image input support was checked against OpenAI's official cookbook:
https://github.com/openai/openai-cookbook/blob/main/examples/gpt4o/introduction_to_gpt4o.ipynb
It explicitly documents text/image input for gpt-4o-mini and demonstrates image calls.
This establishes model modality, not current account access, latency or accuracy.

Unit tests use synthetic product data, synthetic image-header bytes and mocked
provider responses. Proxy typecheck and deployment dry-run passed. No live key,
proxy URL, allowlisted extension origin or deployment is available in this task;
real provider inference, image decoding, Cloudflare enforcement and costs remain
unverified. For local diagnostics, the existing managed environment may also require
outbound access to api.openai.com, the selected CDN hosts and the deployed Worker.
