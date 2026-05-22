// CORS proxy for Claude Office Add-in

function parseModels(env) {
  const models = env.KNOWN_MODELS
    ? env.KNOWN_MODELS.split(",").map((s) => s.trim())
    : [];
  const defaultModel = env.DEFAULT_MODEL?.trim() || "";
  return { models, defaultModel };
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

function mockModelsResponse(origin, knownModels) {
  const models = knownModels.map((id) => ({
    type: "model",
    id,
    display_name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    created_at: "2025-01-01T00:00:00Z",
  }));
  return new Response(
    JSON.stringify({
      data: models,
      first_id: models[0]?.id ?? null,
      last_id: models[models.length - 1]?.id ?? null,
      has_more: false,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders(origin) },
    }
  );
}

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || "https://pivot.claude.ai";
    const targetBase = env.TARGET_BASE;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const { models: knownModels, defaultModel } = parseModels(env);
    const url = new URL(request.url);

    // Intercept /v1/models
    if (url.pathname === "/v1/models" && request.method === "GET") {
      return mockModelsResponse(origin, knownModels);
    }

    // Forward everything else — map unknown model names to default
    const targetUrl = targetBase + url.pathname + url.search;

    let body = request.body;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json") && request.body) {
      try {
        const text = await request.text();
        const data = JSON.parse(text);

        if (
          defaultModel &&
          data.model &&
          knownModels.length > 0 &&
          !knownModels.includes(data.model)
        ) {
          data.model = defaultModel;
        }

        body = JSON.stringify(data);
      } catch (e) {
        body = request.body;
      }
    }

    const headers = new Headers(request.headers);
    if (typeof body === "string") {
      headers.set("content-length", String(new TextEncoder().encode(body).length));
    }

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
    });

    const response = await fetch(modifiedRequest);

    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    const cors = corsHeaders(origin);
    for (const [key, value] of Object.entries(cors)) {
      modifiedResponse.headers.set(key, value);
    }

    return modifiedResponse;
  },
};
