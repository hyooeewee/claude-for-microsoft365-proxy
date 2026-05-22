// CORS proxy for Claude Office Add-in

function parseModels(env) {
  let modelMap = {};
  try {
    if (env.KNOWN_MODELS) {
      const parsed = JSON.parse(env.KNOWN_MODELS);
      if (parsed && typeof parsed === "object") {
        modelMap = parsed;
      }
    }
  } catch {
    // Fallback: treat as comma-separated list for backward compatibility
    if (env.KNOWN_MODELS) {
      for (const id of env.KNOWN_MODELS.split(",")) {
        const trimmed = id.trim();
        if (trimmed) modelMap[trimmed] = trimmed;
      }
    }
  }

  const models = Object.keys(modelMap);
  const defaultModel = env.DEFAULT_MODEL?.trim() || "";
  return { models, modelMap, defaultModel };
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

function buildCapabilities() {
  return {
    batch: { supported: true },
    citations: { supported: true },
    code_execution: { supported: true },
    context_management: {
      supported: true,
      clear_thinking_20251015: { supported: true },
      clear_tool_uses_20250919: { supported: true },
      compact_20260112: { supported: true },
    },
    effort: {
      supported: true,
      low: { supported: true },
      medium: { supported: true },
      high: { supported: true },
      max: { supported: true },
      xhigh: { supported: true },
    },
    image_input: { supported: true },
    pdf_input: { supported: true },
    structured_outputs: { supported: true },
    thinking: {
      supported: true,
      types: {
        adaptive: { supported: true },
        enabled: { supported: true },
      },
    },
  };
}

function mockModelsResponse(origin, knownModels, modelMap, limit, afterId, beforeId) {
  let models = knownModels.map((id) => ({
    id,
    display_name: modelMap[id] || id,
    created_at: "2026-01-01T00:00:00.000Z",
    capabilities: buildCapabilities(),
    max_input_tokens: 0,
    max_tokens: 0,
    type: "model",
  }));

  if (afterId) {
    const idx = models.findIndex((m) => m.id === afterId);
    if (idx >= 0) models = models.slice(idx + 1);
  }
  if (beforeId) {
    const idx = models.findIndex((m) => m.id === beforeId);
    if (idx >= 0) models = models.slice(0, idx);
  }
  if (limit && limit > 0) {
    models = models.slice(0, Math.min(limit, 1000));
  }

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
    },
  );
}

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || "https://pivot.claude.ai";
    const targetBase = env.TARGET_BASE;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const { models: knownModels, modelMap, defaultModel } = parseModels(env);
    const url = new URL(request.url);

    // Intercept /v1/models
    if (url.pathname === "/v1/models" && request.method === "GET") {
      const limit = parseInt(url.searchParams.get("limit"), 10) || null;
      const afterId = url.searchParams.get("after_id");
      const beforeId = url.searchParams.get("before_id");
      return mockModelsResponse(origin, knownModels, modelMap, limit, afterId, beforeId);
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
        } else if (data.model && modelMap[data.model]) {
          data.model = modelMap[data.model];
        }

        body = JSON.stringify(data);
      } catch (e) {
        body = request.body;
      }
    }

    const headers = new Headers(request.headers);
    if (typeof body === "string") {
      headers.set(
        "content-length",
        String(new TextEncoder().encode(body).length),
      );
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
