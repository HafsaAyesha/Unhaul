interface Env { AI_API_KEY?: string; AI_MODEL?: string; }
export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return Response.json({ status: 'ok', classificationEnabled: false });
    }
    // B: implement validated POST /classify, rate limiting, CORS and provider call.
    // Fail closed until these controls and the provider are configured.
    return Response.json({ error: 'AI classification is not configured' }, { status: 503 });
  },
} satisfies ExportedHandler<Env>;
