import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(1).max(200000),
});

export const fixGrammar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not configured." };
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a grammar and spelling correction tool. Detect the language of the user's text and call the return_correction tool with the SAME text rewritten with grammar, spelling, and punctuation fixed, in the SAME language as the input. Never translate. Preserve the user's tone, line breaks, and meaning. Do not add new content.",
          },
          { role: "user", content: data.text },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_correction",
              description: "Return the corrected text in the same language.",
              parameters: {
                type: "object",
                properties: {
                  language: { type: "string", description: "ISO language name of the input." },
                  corrected: { type: "string", description: "Corrected text, same language." },
                },
                required: ["language", "corrected"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_correction" } },
      }),
    });

    if (res.status === 429) {
      return { ok: false as const, error: "Too many requests — try again in a minute." };
    }
    if (res.status === 402) {
      return {
        ok: false as const,
        error: "AI credits exhausted. Add credits in Settings → Workspace → Usage.",
      };
    }
    if (!res.ok) {
      console.error("Grammar AI error", res.status, await res.text().catch(() => ""));
      return { ok: false as const, error: "Grammar service unavailable." };
    }

    const json = (await res.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { arguments?: string } }>;
          content?: string;
        };
      }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      const fallback = json.choices?.[0]?.message?.content?.trim();
      if (fallback) return { ok: true as const, corrected: fallback, language: "unknown" };
      return { ok: false as const, error: "No correction returned." };
    }
    try {
      const parsed = JSON.parse(args) as { corrected: string; language: string };
      return { ok: true as const, corrected: parsed.corrected, language: parsed.language };
    } catch {
      return { ok: false as const, error: "Could not parse correction." };
    }
  });
