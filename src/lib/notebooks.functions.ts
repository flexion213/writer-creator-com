import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InviteInput = z.object({
  notebookId: z.string().uuid(),
  username: z.string().trim().min(1).max(64),
  canEdit: z.boolean(),
});

export const inviteByUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirm the caller owns the notebook (defense in depth + nicer error).
    const { data: nb, error: nbErr } = await supabase
      .from("notebooks")
      .select("id, owner_id")
      .eq("id", data.notebookId)
      .maybeSingle();
    if (nbErr) return { ok: false as const, error: "Could not load notebook." };
    if (!nb) return { ok: false as const, error: "Notebook not found." };
    if (nb.owner_id !== userId)
      return { ok: false as const, error: "Only the owner can invite people." };

    // Look up the user by (case-insensitive) username.
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", data.username)
      .maybeSingle();
    if (pErr) return { ok: false as const, error: "Could not look up that user." };
    if (!profile) return { ok: false as const, error: `No user named "${data.username}".` };
    if (profile.id === userId) return { ok: false as const, error: "You can't invite yourself." };

    const { error: insErr } = await supabase
      .from("notebook_members")
      .upsert(
        { notebook_id: data.notebookId, user_id: profile.id, can_edit: data.canEdit },
        { onConflict: "notebook_id,user_id" },
      );
    if (insErr) return { ok: false as const, error: "Could not invite that user." };

    return { ok: true as const, username: profile.username };
  });

const MigrateInput = z.object({
  notebooks: z
    .array(
      z.object({
        title: z.string().max(200).default("Untitled"),
        body: z.string().max(200000).default(""),
      }),
    )
    .max(200),
});

export const migrateLocalNotebooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MigrateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.notebooks.length === 0) return { ok: true as const, count: 0 };
    const rows = data.notebooks.map((n) => ({
      owner_id: userId,
      title: n.title || "Untitled",
      body: n.body || "",
    }));
    const { error } = await supabase.from("notebooks").insert(rows);
    if (error) return { ok: false as const, error: "Could not import notebooks." };
    return { ok: true as const, count: rows.length };
  });
