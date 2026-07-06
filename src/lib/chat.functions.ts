import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  notebookId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

type ModerationVerdict = {
  allow: boolean;
  reason: string;
};

async function moderate(text: string): Promise<ModerationVerdict> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { allow: true, reason: "moderation-disabled" };

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
            "You moderate a private collaborative notebook chat. Policy: BLOCK slurs targeting any group, harassment, hateful insults aimed at a person, sexual content involving minors, threats of violence, doxxing, spam, and scams. ALLOW casual swearing not aimed at anyone, normal disagreement, jokes, work talk, and emoji. Call the verdict tool with allow=true to send the message, or allow=false with a short reason (max 12 words) when it must be blocked.",
        },
        { role: "user", content: text },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "verdict",
            description: "Return moderation verdict for the message.",
            parameters: {
              type: "object",
              properties: {
                allow: { type: "boolean" },
                reason: { type: "string" },
              },
              required: ["allow", "reason"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "verdict" } },
    }),
  });

  if (!res.ok) {
    // Fail closed on auth/quota errors so we don't accidentally let things through silently.
    if (res.status === 429 || res.status === 402) {
      return { allow: false, reason: "Moderator is busy — try again in a moment." };
    }
    console.error("Moderation error", res.status, await res.text().catch(() => ""));
    return { allow: false, reason: "Moderation unavailable — message held." };
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
    }>;
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { allow: true, reason: "no-verdict" };
  try {
    const parsed = JSON.parse(args) as ModerationVerdict;
    return { allow: !!parsed.allow, reason: parsed.reason ?? "" };
  } catch {
    return { allow: true, reason: "parse-fail" };
  }
}

export const sendModeratedMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Membership is enforced by RLS on the insert too, but we check up front for a nicer error.
    const { data: nb } = await supabase
      .from("notebooks")
      .select("id")
      .eq("id", data.notebookId)
      .maybeSingle();
    if (!nb) return { ok: false as const, error: "No access to this notebook." };

    const verdict = await moderate(data.body);
    if (!verdict.allow) {
      return { ok: false as const, error: verdict.reason || "Message blocked by moderation." };
    }

    const { error } = await supabase
      .from("notebook_messages")
      .insert({ notebook_id: data.notebookId, user_id: userId, body: data.body });
    if (error) return { ok: false as const, error: "Could not send message." };
    return { ok: true as const };
  });
