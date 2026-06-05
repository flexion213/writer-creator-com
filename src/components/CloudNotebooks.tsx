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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  NotebookPen, Plus, Trash2, Wand2, Loader2, Users, MessageCircle,
  UserPlus, Send, ShieldCheck, X, LogIn, Shield, ArrowLeft, BookOpen,
  Clock, ChevronUp, ChevronDown, Globe2, Target, StickyNote,
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
};
type Character = {
  id: string;
  notebook_id: string;
  name: string;
  role: string;
  traits: string;
  backstory: string;
};
type TimelineEvent = {
  id: string;
  notebook_id: string;
  title: string;
  description: string;
  event_order: number;
  event_date: string;
};
type Lore = {
  id: string;
  notebook_id: string;
  category: string;
  title: string;
  details: string;
};
const LORE_CATEGORIES = ["Location", "Faction", "Power System", "Item", "Race", "Other"] as const;

export function CloudNotebooks({ runFix }: { runFix: (text: string) => Promise<string | null> }) {
  const { user, profile, loading, isAdmin, isModerator } = useAuth();
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [fetching, setFetching] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const migrate = useServerFn(migrateLocalNotebooks);
  const migratedRef = useRef(false);

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
            Your notebooks sync across devices, with characters and timeline.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/auth" })} className="w-full">
          <LogIn className="h-4 w-4 mr-1" /> Sign in or create account
        </Button>
      </Card>
    );
  }

  const addNotebook = async () => {
    const { data, error } = await supabase.from("notebooks").insert({
      owner_id: user.id, title: "Untitled", body: "",
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    if (data) setOpenId((data as Notebook).id);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this notebook?")) return;
    const { error } = await supabase.from("notebooks").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const openNotebook = notebooks.find((n) => n.id === openId) ?? null;

  if (openNotebook) {
    return (
      <NotebookFullscreen
        notebook={openNotebook}
        currentUserId={user.id}
        currentUsername={profile?.username ?? "you"}
        canModerate={isAdmin || isModerator}
        runFix={runFix}
        onClose={() => setOpenId(null)}
      />
    );
  }

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

      <div className="space-y-2">
        {notebooks.map((nb) => {
          const isOwner = nb.owner_id === user.id;
          return (
            <Card
              key={nb.id}
              className="overflow-hidden border-border/60 bg-gradient-to-b from-card to-card/70 shadow-sm rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setOpenId(nb.id)}
            >
              <div className="p-3 flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{nb.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {nb.body ? nb.body.slice(0, 80) : "Empty notebook"}
                  </p>
                </div>
                {!isOwner && <Badge variant="secondary" className="text-[10px]">shared</Badge>}
                {isOwner && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); void remove(nb.id); }}
                    aria-label="Delete notebook"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Fullscreen single-notebook workspace ----------
function NotebookFullscreen({
  notebook,
  currentUserId,
  currentUsername,
  canModerate,
  runFix,
  onClose,
}: {
  notebook: Notebook;
  currentUserId: string;
  currentUsername: string;
  canModerate: boolean;
  runFix: (text: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(notebook.title);
  const [body, setBody] = useState(notebook.body);
  const [saving, setSaving] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [tab, setTab] = useState<"write" | "characters" | "timeline" | "lore">("write");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [lore, setLore] = useState<Lore[]>([]);
  const [loreFilter, setLoreFilter] = useState<string>("All");
  const [wordGoal, setWordGoal] = useState<number>(() => {
    if (typeof window === "undefined") return 500;
    const v = Number(window.localStorage.getItem(`nb:goal:${notebook.id}`) ?? 500);
    return Number.isFinite(v) && v > 0 ? v : 500;
  });
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratch, setScratch] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(`nb:scratch:${notebook.id}`) ?? "";
  });
  const [openSharing, setOpenSharing] = useState(false);
  const [openChat, setOpenChat] = useState(false);
  const isOwner = notebook.owner_id === currentUserId;

  // Persist scratchpad + goal per-notebook
  useEffect(() => {
    try { window.localStorage.setItem(`nb:scratch:${notebook.id}`, scratch); } catch {}
  }, [scratch, notebook.id]);
  useEffect(() => {
    try { window.localStorage.setItem(`nb:goal:${notebook.id}`, String(wordGoal)); } catch {}
  }, [wordGoal, notebook.id]);

  const bodyWordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const goalPct = Math.min(100, Math.round((bodyWordCount / Math.max(1, wordGoal)) * 100));

  // Sync incoming changes
  useEffect(() => { setTitle(notebook.title); setBody(notebook.body); }, [notebook.id]);

  // Load characters + timeline
  useEffect(() => {
    void (async () => {
      const [{ data: cd }, { data: td }, { data: ld }] = await Promise.all([
        supabase.from("notebook_characters").select("*").eq("notebook_id", notebook.id),
        supabase.from("notebook_timeline_events").select("*").eq("notebook_id", notebook.id).order("event_order"),
        supabase.from("notebook_lore").select("*").eq("notebook_id", notebook.id).order("created_at"),
      ]);
      setCharacters((cd as Character[]) ?? []);
      setTimeline((td as TimelineEvent[]) ?? []);
      setLore((ld as Lore[]) ?? []);
    })();
  }, [notebook.id]);

  // Debounced autosave
  useEffect(() => {
    if (title === notebook.title && body === notebook.body) return;
    const t = window.setTimeout(async () => {
      setSaving(true);
      await supabase.from("notebooks").update({ title, body }).eq("id", notebook.id);
      setSaving(false);
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  const addCharacter = async () => {
    const { data } = await supabase.from("notebook_characters").insert({
      notebook_id: notebook.id, name: "New character",
    }).select("*").single();
    if (data) setCharacters((cs) => [...cs, data as Character]);
  };
  const updateCharacter = async (id: string, patch: Partial<Character>) => {
    setCharacters((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("notebook_characters").update(patch).eq("id", id);
  };
  const removeCharacter = async (id: string) => {
    setCharacters((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("notebook_characters").delete().eq("id", id);
  };

  const addEvent = async () => {
    const { data } = await supabase.from("notebook_timeline_events").insert({
      notebook_id: notebook.id, title: "New event", event_order: timeline.length,
    }).select("*").single();
    if (data) setTimeline((xs) => [...xs, data as TimelineEvent]);
  };
  const updateEvent = async (id: string, patch: Partial<TimelineEvent>) => {
    setTimeline((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("notebook_timeline_events").update(patch).eq("id", id);
  };
  const removeEvent = async (id: string) => {
    setTimeline((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("notebook_timeline_events").delete().eq("id", id);
  };
  const moveEvent = async (id: string, dir: -1 | 1) => {
    const idx = timeline.findIndex((e) => e.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= timeline.length) return;
    const next = [...timeline];
    [next[idx], next[j]] = [next[j], next[idx]];
    const reorder = next.map((e, i) => ({ ...e, event_order: i }));
    setTimeline(reorder);
    await Promise.all(reorder.map((e) =>
      supabase.from("notebook_timeline_events").update({ event_order: e.event_order }).eq("id", e.id)
    ));
  };

  const addLore = async (category: string) => {
    const { data } = await supabase.from("notebook_lore").insert({
      notebook_id: notebook.id, category, title: "Untitled",
    }).select("*").single();
    if (data) setLore((xs) => [...xs, data as Lore]);
  };
  const updateLore = async (id: string, patch: Partial<Lore>) => {
    setLore((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("notebook_lore").update(patch).eq("id", id);
  };
  const removeLore = async (id: string) => {
    setLore((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("notebook_lore").delete().eq("id", id);
  };

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <header className="flex items-center gap-2 px-3 h-14 border-b bg-card/60 backdrop-blur shrink-0">
        <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onClose} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 h-9 rounded-2xl font-semibold"
          placeholder="Notebook title"
        />
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {saving ? "Saving…" : "Saved"}
        </span>
        {isOwner && (
          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={() => setOpenSharing(true)} aria-label="Share">
            <Users className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="rounded-2xl" onClick={() => setOpenChat(true)} aria-label="Chat">
          <MessageCircle className="h-4 w-4" />
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-3 grid grid-cols-4 rounded-2xl shrink-0">
          <TabsTrigger value="write" className="rounded-2xl"><BookOpen className="h-3.5 w-3.5 mr-1" /> Write</TabsTrigger>
          <TabsTrigger value="characters" className="rounded-2xl"><Users className="h-3.5 w-3.5 mr-1" /> Characters</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-2xl"><Clock className="h-3.5 w-3.5 mr-1" /> Timeline</TabsTrigger>
          <TabsTrigger value="lore" className="rounded-2xl"><Globe2 className="h-3.5 w-3.5 mr-1" /> Lore</TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="flex-1 min-h-0 m-0 mt-3 px-3 pb-3 flex flex-col gap-2">
          {/* Word goal progress bar */}
          <div className="flex items-center gap-2 px-1">
            <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums w-20 text-right">
              {bodyWordCount} / {wordGoal}
            </span>
            <Input
              type="number"
              min={50}
              max={50000}
              value={wordGoal}
              onChange={(e) => setWordGoal(Math.max(50, Number(e.target.value) || 500))}
              className="h-7 w-20 rounded-xl text-[11px]"
              aria-label="Daily word goal"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-xl"
              onClick={() => setScratchOpen(true)}
              aria-label="Open scratchpad"
              title="Scratchpad"
            >
              <StickyNote className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start writing your story…"
            className="flex-1 resize-none border-0 bg-muted/20 rounded-2xl text-base leading-relaxed focus-visible:ring-1 p-4"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm" variant="outline" className="rounded-full"
              disabled={!body.trim() || fixing}
              onClick={async () => {
                setFixing(true);
                const fixed = await runFix(body);
                if (fixed) setBody(fixed);
                setFixing(false);
              }}
            >
              {fixing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
              Fix grammar
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="characters" className="flex-1 min-h-0 m-0 mt-3 px-3 pb-3 overflow-y-auto space-y-3">
          <Button size="sm" variant="outline" className="w-full rounded-2xl" onClick={addCharacter}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add character
          </Button>
          {characters.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No characters yet.</p>
          )}
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="p-2">Name</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Traits</th>
                  <th className="p-2">Backstory</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {characters.map((c) => (
                  <tr key={c.id} className="border-t align-top">
                    <td className="p-2"><Input value={c.name} onChange={(e) => updateCharacter(c.id, { name: e.target.value })} className="h-8 rounded-xl" /></td>
                    <td className="p-2"><Input value={c.role} onChange={(e) => updateCharacter(c.id, { role: e.target.value })} className="h-8 rounded-xl" placeholder="Protagonist" /></td>
                    <td className="p-2"><Textarea value={c.traits} onChange={(e) => updateCharacter(c.id, { traits: e.target.value })} className="min-h-[60px] rounded-xl text-xs" placeholder="Brave, witty…" /></td>
                    <td className="p-2"><Textarea value={c.backstory} onChange={(e) => updateCharacter(c.id, { backstory: e.target.value })} className="min-h-[60px] rounded-xl text-xs" placeholder="Backstory" /></td>
                    <td className="p-2"><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => removeCharacter(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="flex-1 min-h-0 m-0 mt-3 px-3 pb-3 overflow-y-auto space-y-3">
          <Button size="sm" variant="outline" className="w-full rounded-2xl" onClick={addEvent}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add event
          </Button>
          {timeline.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No events yet. Map your plot beats here.</p>
          )}
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
            {timeline.map((ev, i) => (
              <div key={ev.id} className="relative pl-4 pb-4">
                <div className="absolute left-[-1px] top-2 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                <div className="rounded-2xl border bg-background/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={ev.title} onChange={(e) => updateEvent(ev.id, { title: e.target.value })} className="h-8 rounded-2xl font-medium" placeholder="Event" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-2xl" disabled={i === 0} onClick={() => moveEvent(ev.id, -1)}><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-2xl" disabled={i === timeline.length - 1} onClick={() => moveEvent(ev.id, 1)}><ChevronDown className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-2xl hover:text-destructive" onClick={() => removeEvent(ev.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <Input value={ev.event_date} onChange={(e) => updateEvent(ev.id, { event_date: e.target.value })} placeholder="When (e.g. Year 312)" className="h-8 rounded-2xl text-xs" />
                  <Textarea value={ev.description} onChange={(e) => updateEvent(ev.id, { description: e.target.value })} placeholder="What happens" className="rounded-2xl text-xs min-h-[50px]" />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="lore" className="flex-1 min-h-0 m-0 mt-3 px-3 pb-3 overflow-y-auto space-y-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {(["All", ...LORE_CATEGORIES] as const).map((cat) => {
              const active = loreFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setLoreFilter(cat)}
                  className={`shrink-0 px-3 h-8 rounded-full text-xs transition ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {LORE_CATEGORIES.map((cat) => (
              <Button key={cat} size="sm" variant="outline" className="rounded-full" onClick={() => addLore(cat)}>
                <Plus className="h-3 w-3 mr-1" /> {cat}
              </Button>
            ))}
          </div>
          {lore.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Build your world. Add locations, factions, power systems and more.
            </p>
          )}
          <div className="grid grid-cols-1 gap-2">
            {lore
              .filter((l) => loreFilter === "All" || l.category === loreFilter)
              .map((l) => (
              <Card key={l.id} className="p-3 space-y-2 rounded-2xl">
                <div className="flex items-center gap-2">
                  <select
                    value={l.category}
                    onChange={(e) => updateLore(l.id, { category: e.target.value })}
                    className="h-7 rounded-xl border bg-background text-xs px-2"
                  >
                    {LORE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input
                    value={l.title}
                    onChange={(e) => updateLore(l.id, { title: e.target.value })}
                    className="h-7 rounded-xl text-sm font-medium flex-1"
                    placeholder="Name"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => removeLore(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  value={l.details}
                  onChange={(e) => updateLore(l.id, { details: e.target.value })}
                  placeholder="Describe it…"
                  className="rounded-xl min-h-[70px] text-xs"
                />
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={openSharing} onOpenChange={setOpenSharing}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-md overflow-y-auto">
          <SharingPanel notebookId={notebook.id} />
        </SheetContent>
      </Sheet>
      <Sheet open={openChat} onOpenChange={setOpenChat}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-md flex flex-col p-0">
          <ChatPanel
            notebookId={notebook.id}
            notebookTitle={title || "Notebook"}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            canModerate={canModerate}
          />
        </SheetContent>
      </Sheet>

      {/* Quick scratchpad — collapsible slide-out */}
      <Sheet open={scratchOpen} onOpenChange={setScratchOpen}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-sm flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <StickyNote className="h-4 w-4" /> Scratchpad
            </SheetTitle>
            <p className="text-[10px] text-muted-foreground">Quick notes, brainstorming, plot beats. Saved on this device.</p>
          </SheetHeader>
          <Textarea
            value={scratch}
            onChange={(e) => setScratch(e.target.value)}
            placeholder="Jot anything…"
            className="flex-1 m-3 rounded-2xl resize-none text-sm"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SharingPanel({ notebookId }: { notebookId: string }) {
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
      .on("postgres_changes", { event: "*", schema: "public", table: "notebook_members", filter: `notebook_id=eq.${notebookId}` }, () => { void load(); })
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
      setUsername(""); setCanEdit(false); void load();
    } finally { setBusy(false); }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Share notebook</SheetTitle>
      </SheetHeader>
      <form onSubmit={submit} className="mt-4 space-y-2">
        <Label htmlFor="invite-user" className="text-xs">Invite by username</Label>
        <div className="flex gap-2">
          <Input id="invite-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" autoCapitalize="off" autoCorrect="off" />
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
              <p className="text-[10px] text-muted-foreground">{m.can_edit ? "Editor" : "Viewer"}</p>
            </div>
            <Button size="sm" variant={m.can_edit ? "default" : "outline"} className="text-[10px] h-7"
              onClick={async () => { await supabase.from("notebook_members").update({ can_edit: !m.can_edit }).eq("notebook_id", m.notebook_id).eq("user_id", m.user_id); void load(); }}>
              {m.can_edit ? "Editor" : "Viewer"}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
              onClick={async () => { await supabase.from("notebook_members").delete().eq("notebook_id", m.notebook_id).eq("user_id", m.user_id); void load(); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}

function ChatPanel({
  notebookId, notebookTitle, currentUserId, currentUsername, canModerate,
}: {
  notebookId: string; notebookTitle: string; currentUserId: string;
  currentUsername: string; canModerate: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const send = useServerFn(sendModeratedMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchUsernames = async (ids: string[]) => {
    const missing = Array.from(new Set(ids)).filter((id) => !userMap[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from("profiles").select("id, username").in("id", missing);
    if (data) {
      setUserMap((prev) => {
        const next = { ...prev };
        for (const p of data as Array<{ id: string; username: string }>) next[p.id] = p.username;
        return next;
      });
    }
  };

  useEffect(() => {
    let alive = true;
    supabase.from("notebook_messages").select("*").eq("notebook_id", notebookId).order("created_at").limit(200)
      .then(({ data }) => {
        if (!alive) return;
        const rows = (data as Message[]) ?? [];
        setMessages(rows);
        void fetchUsernames(rows.map((r) => r.user_id));
      });
    const ch = supabase
      .channel(`messages:${notebookId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notebook_messages", filter: `notebook_id=eq.${notebookId}` }, (payload) => {
        const row = payload.new as Message;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        void fetchUsernames([row.user_id]);
      })
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
      if (!r.ok) { toast.error(`Blocked: ${r.error}`); return; }
      setDraft("");
    } finally { setSending(false); }
  };

  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-2 border-b">
        <SheetTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" /> {notebookTitle}
        </SheetTitle>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Moderated by AI.
        </p>
      </SheetHeader>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No messages yet. Say hi 👋</p>}
        {messages.map((m) => {
          const mine = m.user_id === currentUserId;
          const name = mine ? currentUsername : (userMap[m.user_id] ?? "user");
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-accent"}`}>
                {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">@{name}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="border-t p-3 flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" maxLength={2000} disabled={sending} />
        <Button type="submit" disabled={sending || !draft.trim()} size="icon">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </>
  );
}