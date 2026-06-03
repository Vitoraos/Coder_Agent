import { callLLM, callLLMJson } from "../_shared/llm.ts";

Deno.serve(async (req) => {
  try {
    // Test 1: Basic text response
    const textResult = await callLLM([
      {
        role: "user",
        content: "Reply with exactly: LLM connection successful",
      },
    ]);

    // Test 2: JSON response — this is what planner and coder will use
    const jsonResult = await callLLMJson<{ status: string; model: string }>([
      {
        role: "system",
        content: "You respond only with valid JSON. No markdown, no explanation.",
      },
      {
        role: "user",
        content: `Reply with this exact JSON: { "status": "ok", "model": "working" }`,
      },
    ]);

    return new Response(
      JSON.stringify({
        test1_text: textResult,
        test2_json: jsonResult,
        success: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
