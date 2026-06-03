const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMOptions = {
  model?: string;
  max_tokens?: number;
  temperature?: number;
};

export async function callLLM(
  messages: Message[],
  options: LLMOptions = {}
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const model = options.model ?? "anthropic/claude-3.5-sonnet";
  const max_tokens = options.max_tokens ?? 2000;
  const temperature = options.temperature ?? 0.2;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/vitoraos/coder-agent",
      "X-Title": "coder-agent",
    },
    body: JSON.stringify({
      model,
      max_tokens,
      temperature,
      messages,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${error}`);
  }

  const data = await res.json();

  // Guard against unexpected response shapes
  if (!data.choices || !data.choices[0]?.message?.content) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(data)}`);
  }

  return data.choices[0].message.content as string;
}


// Separate helper for when you need structured JSON back
// Wraps callLLM and handles parse errors cleanly
export async function callLLMJson<T>(
  messages: Message[],
  options: LLMOptions = {}
): Promise<T> {
  const raw = await callLLM(messages, options);

  // Strip markdown code fences if the model wraps JSON in them
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`LLM returned invalid JSON:\n${raw}`);
  }
}
