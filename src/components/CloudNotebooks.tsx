import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { inviteByUsername, migrateLocalNotebooks } from "@/lib/notebooks.functions";
import { sendModeratedMessage } from "@/lib/chat.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  NotebookPen, Plus, Trash2, Wand2, Loader2, Users, MessageCircle,
  UserPlus, Send, ShieldCheck, X, LogIn, Shield,
} from "lucide-react";

type Notebook = {
  id: string;
  owner_id: string;
  title: string;
  body: string;
  updated_at: string;
};
type Member = {
  notebook_id: string;
  user_id: string;
  can_edit: boolean;
  profile?: { username: string; display_name: string | null };
};
type Message = {
  id: string;
  notebook_id: string;
  user_id: string;
  body: string;
  created_at: string;
  username?: string;
};

export function CloudNotebooks({ runFix }: { runFix: (text: string) => Promise<string | null> }) {
  const { user, profile, loading, isAdmin, isModerator } = useAuth();
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [openSharingFor, setOpenSharingFor] = useState<string | null>(null);
  const [openChatFor, setOpenChatFor] = useState<string | null>(null);
  const migrate = useServerFn(migrateLocalNotebooks);
  const migratedRef = useRef(false);

  // Initial load + realtime
  useEffect(() => {
    if (!user) { setNotebooks([]); setFetching(false); return; }
    let alive = true;
    setFetching(true);
    supabase
      .from("notebooks")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (!alive) return;
        setNotebooks((data as Notebook[]) ?? []);
        setFetching(false);
      });
    const ch = supabase
      .channel(`notebooks:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notebooks" }, (payload) => {
        setNotebooks((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Notebook;
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Notebook;
            return prev.map((n) => (n.id === row.id ? row : n))
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as Notebook;
            return prev.filter((n) => n.id !== row.id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [user]);

  // One-time migration of localStorage notebooks
  useEffect(() => {
    if (!user || migratedRef.current) return;
    if (typeof window === "undefined") return;
    const migratedKey = `dd:notebooks-migrated:${user.id}`;
    if (window.localStorage.getItem(migratedKey)) return;
    const raw = window.localStorage.getItem("dd:notebooks");
    if (!raw) { window.localStorage.setItem(migratedKey, "1"); return; }
    try {
      const arr = JSON.parse(raw) as Array<{ title: string; body: string }>;
      const usable = arr
        .filter((n) => (n.title?.trim() || n.body?.trim()))
        .map((n) => ({ title: (n.title || "Untitled").slice(0, 200), body: (n.body || "").slice(0, 200000) }));
      if (usable.length === 0) { window.localStorage.setItem(migratedKey, "1"); return; }
      migratedRef.current = true;
      migrate({ data: { notebooks: usable } }).then((r) => {
        if (r.ok) {
          toast.success(`Imported ${r.count} notebook${r.count === 1 ? "" : "s"} into your account.`);
          window.localStorage.removeItem("dd:notebooks");
          window.localStorage.setItem(migratedKey, "1");
        }
      });
    } catch {
      window.localStorage.setItem(migratedKey, "1");
    }
  }, [user, migrate]);

  if (loading) {
    return <Card className="p-8 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></Card>;
  }

  if (!user) {
    return (
      <Card className="p-6 text-center space-y-3">
        <NotebookPen className="h-8 w-8 mx-auto text-muted-foreground/70" />
        <div>
          <p className="text-sm font-medium">Sign in to use cloud notebooks</p>
          <p className="text-xs text-muted-foreground">
            Your notebooks sync across devices, and you can invite people by username.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/auth" })} className="w-full">
          <LogIn className="h-4 w-4 mr-1" /> Sign in or create account
        </Button>
      </Card>
    );
  }

  const addNotebook = async () => {
    const { error } = await supabase.from("notebooks").insert({
      owner_id: user.id,
      title: "Untitled",
      body: "",
    });
    if (error) toast.error(error.message);
  };

  const update = async (id: string, patch: Partial<Pick<Notebook, "title" | "body">>) => {
    // Optimistic
    setNotebooks((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n)));
    const { error } = await supabase.from("notebooks").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this notebook?")) return;
    const { error } = await supabase.from("notebooks").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/50 ring-1 ring-border">
            <NotebookPen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Notebooks</h2>
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="text-foreground">@{profile?.username ?? "…"}</span>
            </p>
          </div>
        </div>
        <Button size="sm" onClick={addNotebook} className="rounded-full">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      {fetching && (
        <Card className="p-6 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></Card>
      )}

      {!fetching && notebooks.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <NotebookPen className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No notebooks yet</p>
          <p className="text-xs text-muted-foreground">Tap "New" to start one.</p>
        </Card>
      )}

      <div className="space-y-3">
        {notebooks.map((nb) => {
          const fixing = fixingId === nb.id;
          const isOwner = nb.owner_id === user.id;
          return (
            <Card
              key={nb.id}
              className="overflow-hidden border-border/60 bg-gradient-to-b from-card to-card/70 shadow-sm rounded-2xl"
            >
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={nb.title}
                    onChange={(e) => update(nb.id, { title: e.target.value })}
                    placeholder="Title"
                    className="h-8 border-0 bg-transparent px-0 text-base font-semibold focus-visible:ring-0"
                  />
                  {!isOwner && <Badge variant="secondary" className="text-[10px]">shared</Badge>}
                  {isOwner && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(nb.id)}
                      aria-label="Delete notebook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={nb.body}
                  onChange={(e) => update(nb.id, { body: e.target.value })}
                  placeholder="Start writing…"
                  className="min-h-24 resize-none border-0 bg-muted/30 rounded-lg focus-visible:ring-1"
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex gap-1">
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setOpenSharingFor(nb.id)}
                      >
                        <Users className="h-3.5 w-3.5 mr-1" /> Share
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setOpenChatFor(nb.id)}
                    >
                      <MessageCircle className="h-3.5 w-3.5 mr-1" /> Chat
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!nb.body.trim() || fixing}
                    className="rounded-full"
                    onClick={async () => {
                      setFixingId(nb.id);
                      const fixed = await runFix(nb.body);
                      if (fixed) await update(nb.id, { body: fixed });
                      setFixingId(null);
                    }}
                  >
                    {fixing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                    Fix
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-[11px]">
        <Link to="/auth" className="underline text-muted-foreground">Account & sign out</Link>
      </p>

      {/* Sharing sheet */}
      <Sheet open={!!openSharingFor} onOpenChange={(o) => { if (!o) setOpenSharingFor(null); }}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-md overflow-y-auto">
          {openSharingFor && (
            <SharingPanel notebookId={openSharingFor} ownerId={user.id} />
          )}
        </SheetContent>
      </Sheet>

      {/* Chat sheet */}
      <Sheet open={!!openChatFor} onOpenChange={(o) => { if (!o) setOpenChatFor(null); }}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-md flex flex-col p-0">
          {openChatFor && (
            <ChatPanel
              notebookId={openChatFor}
              notebookTitle={notebooks.find((n) => n.id === openChatFor)?.title ?? "Notebook"}
              currentUserId={user.id}
              currentUsername={profile?.username ?? "you"}
              canModerate={isAdmin || isModerator}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SharingPanel({ notebookId, ownerId }: { notebookId: string; ownerId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [username, setUsername] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const invite = useServerFn(inviteByUsername);

  const load = async () => {
    const { data } = await supabase
      .from("notebook_members")
      .select("notebook_id, user_id, can_edit, profile:profiles!notebook_members_user_id_fkey(username, display_name)")
      .eq("notebook_id", notebookId);
    setMembers((data as unknown as Member[]) ?? []);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`members:${notebookId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notebook_members", filter: `notebook_id=eq.${notebookId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    try {
      const r = await invite({ data: { notebookId, username: username.trim(), canEdit } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Invited @${r.username}`);
      setUsername("");
      setCanEdit(false);
      void load();
    } finally {
      setBusy(false);
    }
  };

  const toggleEdit = async (m: Member) => {
    const { error } = await supabase
      .from("notebook_members")
      .update({ can_edit: !m.can_edit })
      .eq("notebook_id", m.notebook_id)
      .eq("user_id", m.user_id);
    if (error) toast.error(error.message);
    else void load();
  };

  const removeMember = async (m: Member) => {
    const { error } = await supabase
      .from("notebook_members")
      .delete()
      .eq("notebook_id", m.notebook_id)
      .eq("user_id", m.user_id);
    if (error) toast.error(error.message);
    else void load();
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Share notebook
        </SheetTitle>
      </SheetHeader>
      <form onSubmit={submit} className="mt-4 space-y-2">
        <Label htmlFor="invite-user" className="text-xs">Invite by username</Label>
        <div className="flex gap-2">
          <Input
            id="invite-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
          Can edit the notebook
        </label>
      </form>

      <div className="mt-6 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">People with access</p>
        {members.length === 0 && <p className="text-xs text-muted-foreground/70">Nobody invited yet.</p>}
        {members.map((m) => (
          <Card key={m.user_id} className="p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">@{m.profile?.username ?? "user"}</p>
              <p className="text-[10px] text-muted-foreground">
                {m.can_edit ? "Editor — can change the notebook" : "Viewer — read + chat only"}
              </p>
            </div>
            <Button
              size="sm"
              variant={m.can_edit ? "default" : "outline"}
              className="text-[10px] h-7"
              onClick={() => toggleEdit(m)}
            >
              {m.can_edit ? "Editor" : "Viewer"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeMember(m)}
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Card>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-4">
        Only you (the owner) can invite or remove people. {ownerId ? "" : ""}
      </p>
    </>
  );
}

function ChatPanel({
  notebookId,
  notebookTitle,
  currentUserId,
  currentUsername,
  canModerate,
}: {
  notebookId: string;
  notebookTitle: string;
  currentUserId: string;
  currentUsername: string;
  canModerate: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [roleMap, setRoleMap] = useState<Record<string, Array<"admin" | "moderator" | "user">>>({});
  const send = useServerFn(sendModeratedMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchUsernames = async (ids: string[]) => {
    const missing = Array.from(new Set(ids)).filter((id) => !userMap[id]);
    if (missing.length === 0) return;
    const [{ data }, { data: rd }] = await Promise.all([
      supabase.from("profiles").select("id, username").in("id", missing),
      supabase.from("user_roles").select("user_id, role").in("user_id", missing),
    ]);
    if (data) {
      setUserMap((prev) => {
        const next = { ...prev };
        for (const p of data as Array<{ id: string; username: string }>) next[p.id] = p.username;
        return next;
      });
    }
    if (rd) {
      setRoleMap((prev) => {
        const next = { ...prev };
        for (const r of rd as Array<{ user_id: string; role: "admin" | "moderator" | "user" }>) {
          const arr = next[r.user_id] ?? [];
          if (!arr.includes(r.role)) next[r.user_id] = [...arr, r.role];
        }
        return next;
      });
    }
  };

  useEffect(() => {
    let alive = true;
    supabase
      .from("notebook_messages")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (!alive) return;
        const rows = (data as Message[]) ?? [];
        setMessages(rows);
        void fetchUsernames(rows.map((r) => r.user_id));
      });
    const ch = supabase
      .channel(`messages:${notebookId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notebook_messages", filter: `notebook_id=eq.${notebookId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          void fetchUsernames([row.user_id]);
        },
      )
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await send({ data: { notebookId, body } });
      if (!r.ok) {
        toast.error(`Blocked: ${r.error}`);
        return;
      }
      setDraft("");
    } catch {
      toast.error("Could not send message.");
    } finally {
      setSending(false);
    }
  };

  const grouped = useMemo(() => messages, [messages]);

  const deleteMessage = async (id: string) => {
    const { error } = await supabase.from("notebook_messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-2 border-b">
        <SheetTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" /> {notebookTitle}
        </SheetTitle>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Moderated by AI — slurs and harassment are blocked.
        </p>
      </SheetHeader>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {grouped.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Say hi 👋</p>
        )}
        {grouped.map((m) => {
          const mine = m.user_id === currentUserId;
          const name = mine ? currentUsername : (userMap[m.user_id] ?? "user");
          const authorRoles = roleMap[m.user_id] ?? [];
          const isAuthorMod = authorRoles.includes("moderator") || authorRoles.includes("admin");
          const canDelete = mine || canModerate;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="group max-w-[80%] flex items-start gap-1">
                <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-accent"}`}>
                  {!mine && (
                    <p className="text-[10px] font-semibold opacity-70 mb-0.5 flex items-center gap-1">
                      @{name}
                      {isAuthorMod && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-sm px-1 py-[1px] text-[9px] font-bold uppercase tracking-wide text-white"
                          style={{
                            background: "linear-gradient(135deg, #ff1a1a, #8a0000)",
                            boxShadow: "0 0 6px rgba(255, 40, 40, 0.7)",
                          }}
                          title={authorRoles.includes("admin") ? "Admin" : "Moderator"}
                        >
                          <Shield className="h-2.5 w-2.5" />
                          {authorRoles.includes("admin") ? "Admin" : "Mod"}
                        </span>
                      )}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    aria-label="Delete message"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="border-t p-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          maxLength={2000}
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !draft.trim()} size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </>
  );
}