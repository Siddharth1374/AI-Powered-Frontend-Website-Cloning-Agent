import 'dotenv/config';

const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    keyName: 'GROQ_API_KEY',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: process.env.GEMINI_API_KEY,
    keyName: 'GEMINI_API_KEY',
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  },
};

const cfg = PROVIDERS[PROVIDER];

export async function groqChat({ system, user, json = false, maxTokens = 2000, temperature = 0.2 }) {
  if (!cfg) throw new Error(`Unknown LLM_PROVIDER "${PROVIDER}". Use "gemini" or "groq".`);
  if (!cfg.key) throw new Error(`${cfg.keyName} is not set. Add it to server/.env and restart the server.`);

  const body = {
    model: cfg.model,
    temperature,
    max_tokens: maxTokens + 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  if (PROVIDER === 'groq' && cfg.model.startsWith('openai/gpt-oss')) {
    body.reasoning_effort = 'low';
  }
  if (json) body.response_format = { type: 'json_object' };

  let res;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(body),
    });
    if (![429, 500, 502, 503, 504].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${PROVIDER} API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';

  if (json) {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`${PROVIDER} returned invalid JSON: ${err.message}\n--- raw content ---\n${content}`);
    }
  }
  return content;
}
