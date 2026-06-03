import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Focus,
  Moon,
  Sun,
  MessageSquare,
  Cloud,
  CheckCircle2,
  ArrowLeft,
  Users,
  BookOpen,
  Globe2,
  Clock,
  Send,
  ChevronUp,
  ChevronDown,
  Rocket,
} from "lucide-react";

export const Route = createFileRoute("/writer")({
  component: WriterPage,
  head: () => ({
    meta: [
      { title: "Writer Creators — Workspace for fiction writers" },
      {
        name: "description",
        content:
          "A distraction-free writing workspace with chapters, characters, lore, and a world timeline.",
      },
    ],
  }),
});

// ---------- Types ----------
type Project = { id: string; title: string; status: string; updated_at: string };
type Chapter = { id: string; project_id: string; title: string; body: string; position: number };
type Character = {
  id: string;
  project_id: string;
  name: string;
  traits: string;
  backstory: string;
  role: string;
};
type Lore = { id: string; project_id: string; title: string; category: string; details: string };
type TimelineEvent = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  event_order: number;
  event_date: string;
};
type SaveState = "idle" | "saving" | "saved";

// ---------- Page ----------
function WriterPage() {
  const { user, loading } = useAuth();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        Loading workspace…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" />;

  return <Workspace dark={dark} setDark={setDark} userId={user.id} />;
}

// ---------- Workspace ----------
function Workspace({
  dark,
  setDark,
  userId,
}: {
  dark: boolean;
  setDark: (b: boolean) => void;
  userId: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lore, setLore] = useState<Lore[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [bootLoading, setBootLoading] = useState(true);

  // Bootstrap projects
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("writer_projects")
        .select("id, title, status, updated_at")
        .order("updated_at", { ascending: false });
      let list = (data as Project[]) ?? [];
      if (list.length === 0) {
        const { data: created } = await supabase
          .from("writer_projects")
          .insert({ owner_id: userId, title: "My First Project" })
          .select("id, title, status, updated_at")
          .single();
        if (created) list = [created as Project];
      }
      setProjects(list);
      setActiveProjectId(list[0]?.id ?? null);
      setBootLoading(false);
    })();
  }, [userId]);

  // Load project content
  useEffect(() => {
    if (!activeProjectId) return;
    void (async () => {
      const [ch, ca, lo, ti] = await Promise.all([
        supabase
          .from("writer_chapters")
          .select("*")
          .eq("project_id", activeProjectId)
          .order("position"),
        supabase.from("writer_characters").select("*").eq("project_id", activeProjectId),
        supabase.from("writer_lore").select("*").eq("project_id", activeProjectId),
        supabase
          .from("writer_timeline_events")
          .select("*")
          .eq("project_id", activeProjectId)
          .order("event_order"),
      ]);
      const chs = (ch.data as Chapter[]) ?? [];
      setChapters(chs);
      setActiveChapterId(chs[0]?.id ?? null);
      setCharacters((ca.data as Character[]) ?? []);
      setLore((lo.data as Lore[]) ?? []);
      setTimeline((ti.data as TimelineEvent[]) ?? []);
    })();
  }, [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null;

  // ---- Chapter actions ----
  const addChapter = async () => {
    if (!activeProjectId) return;
    const position = chapters.length;
    const { data } = await supabase
      .from("writer_chapters")
      .insert({
        project_id: activeProjectId,
        owner_id: userId,
        title: `Chapter ${position + 1}`,
        position,
      })
      .select("*")
      .single();
    if (data) {
      setChapters((cs) => [...cs, data as Chapter]);
      setActiveChapterId((data as Chapter).id);
    }
  };

  const deleteChapter = async (id: string) => {
    await supabase.from("writer_chapters").delete().eq("id", id);
    setChapters((cs) => cs.filter((c) => c.id !== id));
    if (activeChapterId === id) setActiveChapterId(chapters[0]?.id ?? null);
  };

  const moveChapter = async (id: string, dir: -1 | 1) => {
    const idx = chapters.findIndex((c) => c.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= chapters.length) return;
    const next = [...chapters];
    [next[idx], next[j]] = [next[j], next[idx]];
    const reposit = next.map((c, i) => ({ ...c, position: i }));
    setChapters(reposit);
    await Promise.all(
      reposit.map((c) =>
        supabase.from("writer_chapters").update({ position: c.position }).eq("id", c.id),
      ),
    );
  };

  const renameChapter = async (id: string, title: string) => {
    setChapters((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
    await supabase.from("writer_chapters").update({ title }).eq("id", id);
  };

  // ---- Auto-save chapter body ----
  const saveBody = useCallback(
    async (id: string, body: string) => {
      setSaveState("saving");
      await supabase.from("writer_chapters").update({ body }).eq("id", id);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    },
    [],
  );

  const updateChapterBody = (body: string) => {
    if (!activeChapter) return;
    setChapters((cs) =>
      cs.map((c) => (c.id === activeChapter.id ? { ...c, body } : c)),
    );
  };

  // Debounce auto-save
  useEffect(() => {
    if (!activeChapter) return;
    const id = activeChapter.id;
    const body = activeChapter.body;
    const t = window.setTimeout(() => {
      void saveBody(id, body);
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter?.body]);

  // ---- Project actions ----
  const newProject = async () => {
    const { data } = await supabase
      .from("writer_projects")
      .insert({ owner_id: userId, title: "Untitled Project" })
      .select("id, title, status, updated_at")
      .single();
    if (data) {
      setProjects((ps) => [data as Project, ...ps]);
      setActiveProjectId((data as Project).id);
    }
  };

  const renameProject = async (title: string) => {
    if (!activeProject) return;
    setProjects((ps) =>
      ps.map((p) => (p.id === activeProject.id ? { ...p, title } : p)),
    );
    await supabase.from("writer_projects").update({ title }).eq("id", activeProject.id);
  };

  const publishProject = async () => {
    if (!activeProject) return;
    const next = activeProject.status === "published" ? "draft" : "published";
    setProjects((ps) =>
      ps.map((p) => (p.id === activeProject.id ? { ...p, status: next } : p)),
    );
    await supabase.from("writer_projects").update({ status: next }).eq("id", activeProject.id);
    toast.success(
      next === "published"
        ? "Project marked Live — review requested"
        : "Reverted to Draft",
    );
  };

  if (bootLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        Setting up your workspace…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      {!focusMode && (
        <header className="flex items-center gap-3 px-4 h-14 border-b bg-card/50 backdrop-blur sticky top-0 z-20">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-2xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-semibold tracking-tight">Writer Creators</h1>
          {activeProject && (
            <Input
              value={activeProject.title}
              onChange={(e) => void renameProject(e.target.value)}
              className="ml-2 max-w-xs h-8 rounded-2xl"
            />
          )}
          <div className="ml-auto flex items-center gap-2">
            <SaveIndicator state={saveState} />
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                activeProject?.status === "published"
                  ? "border-emerald-500/40 text-emerald-500 bg-emerald-500/10"
                  : "border-amber-500/40 text-amber-500 bg-amber-500/10"
              }`}
            >
              {activeProject?.status === "published" ? "Live" : "Draft"}
            </span>
            <Button
              size="sm"
              onClick={publishProject}
              variant={activeProject?.status === "published" ? "outline" : "default"}
              className="rounded-2xl"
            >
              <Rocket className="h-3.5 w-3.5 mr-1" />
              {activeProject?.status === "published" ? "Unpublish" : "Request Review"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl"
              onClick={() => setDark(!dark)}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-2xl"
              onClick={() => setFocusMode(true)}
              aria-label="Focus mode"
            >
              <Focus className="h-4 w-4" />
            </Button>
          </div>
        </header>
      )}

      {/* Body */}
      <div className="flex-1 grid" style={{ gridTemplateColumns: focusMode ? "1fr" : "240px 1fr 320px" }}>
        {/* Left: Chapter organizer */}
        {!focusMode && (
          <aside className="border-r bg-card/30 p-3 flex flex-col gap-2 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Projects
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-xl"
                onClick={newProject}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <select
              className="rounded-2xl bg-background border px-3 py-1.5 text-sm"
              value={activeProjectId ?? ""}
              onChange={(e) => setActiveProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Chapters
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-xl"
                onClick={addChapter}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              {chapters.map((c, i) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-2xl px-2 py-1.5 text-sm cursor-pointer ${
                    c.id === activeChapterId
                      ? "bg-primary/15 text-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setActiveChapterId(c.id)}
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate flex-1">{c.title}</span>
                  <button
                    className="opacity-0 group-hover:opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void moveChapter(c.id, -1);
                    }}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void moveChapter(c.id, 1);
                    }}
                    disabled={i === chapters.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteChapter(c.id);
                    }}
                    aria-label="Delete chapter"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {chapters.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-2">
                  No chapters yet. Click + to add one.
                </p>
              )}
            </div>
          </aside>
        )}

        {/* Center: Editor */}
        <main className="flex flex-col min-w-0">
          {focusMode && (
            <div className="flex justify-end p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFocusMode(false)}
                className="rounded-2xl"
              >
                Exit focus
              </Button>
              <SaveIndicator state={saveState} />
            </div>
          )}
          {activeChapter ? (
            <div className="flex flex-col flex-1 max-w-3xl w-full mx-auto px-6 py-6 gap-4">
              <Input
                value={activeChapter.title}
                onChange={(e) => void renameChapter(activeChapter.id, e.target.value)}
                className="text-2xl font-semibold border-0 shadow-none px-0 h-auto rounded-none focus-visible:ring-0"
                placeholder="Chapter title"
              />
              <Textarea
                value={activeChapter.body}
                onChange={(e) => updateChapterBody(e.target.value)}
                placeholder="Start writing your story…"
                className="flex-1 min-h-[60vh] resize-none border-0 shadow-none px-0 text-base leading-relaxed focus-visible:ring-0 rounded-none"
              />
            </div>
          ) : (
            <div className="flex-1 grid place-items-center text-muted-foreground">
              <div className="text-center">
                <p className="mb-2">No chapter selected.</p>
                <Button onClick={addChapter} className="rounded-2xl">
                  <Plus className="h-4 w-4 mr-1" /> New chapter
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Right: World & Character */}
        {!focusMode && activeProjectId && (
          <aside className="border-l bg-card/30 overflow-y-auto">
            <RightPanel
              projectId={activeProjectId}
              userId={userId}
              characters={characters}
              setCharacters={setCharacters}
              lore={lore}
              setLore={setLore}
              timeline={timeline}
              setTimeline={setTimeline}
            />
          </aside>
        )}
      </div>

      {/* Floating feedback button */}
      <FeedbackButton userId={userId} />
    </div>
  );
}

// ---------- Save indicator ----------
function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2">
      {state === "saving" && (
        <>
          <Cloud className="h-3.5 w-3.5 animate-pulse" /> Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Saved
        </>
      )}
      {state === "idle" && (
        <>
          <Cloud className="h-3.5 w-3.5 opacity-50" /> Auto-save on
        </>
      )}
    </span>
  );
}

// ---------- Right panel ----------
function RightPanel({
  projectId,
  userId,
  characters,
  setCharacters,
  lore,
  setLore,
  timeline,
  setTimeline,
}: {
  projectId: string;
  userId: string;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  lore: Lore[];
  setLore: React.Dispatch<React.SetStateAction<Lore[]>>;
  timeline: TimelineEvent[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>;
}) {
  return (
    <Tabs defaultValue="characters" className="p-3">
      <TabsList className="grid grid-cols-3 rounded-2xl">
        <TabsTrigger value="characters" className="rounded-2xl">
          <Users className="h-3.5 w-3.5 mr-1" /> Cast
        </TabsTrigger>
        <TabsTrigger value="lore" className="rounded-2xl">
          <Globe2 className="h-3.5 w-3.5 mr-1" /> Lore
        </TabsTrigger>
        <TabsTrigger value="timeline" className="rounded-2xl">
          <Clock className="h-3.5 w-3.5 mr-1" /> Timeline
        </TabsTrigger>
      </TabsList>

      <TabsContent value="characters" className="space-y-3">
        <Button
          size="sm"
          variant="outline"
          className="w-full rounded-2xl"
          onClick={async () => {
            const { data } = await supabase
              .from("writer_characters")
              .insert({ project_id: projectId, owner_id: userId, name: "New Character" })
              .select("*")
              .single();
            if (data) setCharacters((cs) => [...cs, data as Character]);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add character
        </Button>
        {characters.map((c) => (
          <CharacterCard
            key={c.id}
            character={c}
            onChange={(patch) => {
              setCharacters((cs) => cs.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
              void supabase.from("writer_characters").update(patch).eq("id", c.id);
            }}
            onDelete={async () => {
              await supabase.from("writer_characters").delete().eq("id", c.id);
              setCharacters((cs) => cs.filter((x) => x.id !== c.id));
            }}
          />
        ))}
      </TabsContent>

      <TabsContent value="lore" className="space-y-3">
        <Button
          size="sm"
          variant="outline"
          className="w-full rounded-2xl"
          onClick={async () => {
            const { data } = await supabase
              .from("writer_lore")
              .insert({ project_id: projectId, owner_id: userId, title: "New Entry" })
              .select("*")
              .single();
            if (data) setLore((xs) => [...xs, data as Lore]);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add entry
        </Button>
        {lore.map((l) => (
          <LoreCard
            key={l.id}
            lore={l}
            onChange={(patch) => {
              setLore((xs) => xs.map((x) => (x.id === l.id ? { ...x, ...patch } : x)));
              void supabase.from("writer_lore").update(patch).eq("id", l.id);
            }}
            onDelete={async () => {
              await supabase.from("writer_lore").delete().eq("id", l.id);
              setLore((xs) => xs.filter((x) => x.id !== l.id));
            }}
          />
        ))}
      </TabsContent>

      <TabsContent value="timeline" className="space-y-3">
        <Button
          size="sm"
          variant="outline"
          className="w-full rounded-2xl"
          onClick={async () => {
            const order = timeline.length;
            const { data } = await supabase
              .from("writer_timeline_events")
              .insert({
                project_id: projectId,
                owner_id: userId,
                title: "New event",
                event_order: order,
              })
              .select("*")
              .single();
            if (data) setTimeline((xs) => [...xs, data as TimelineEvent]);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add event
        </Button>
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          {timeline.map((ev) => (
            <TimelineRow
              key={ev.id}
              event={ev}
              onChange={(patch) => {
                setTimeline((xs) =>
                  xs.map((x) => (x.id === ev.id ? { ...x, ...patch } : x)),
                );
                void supabase.from("writer_timeline_events").update(patch).eq("id", ev.id);
              }}
              onDelete={async () => {
                await supabase.from("writer_timeline_events").delete().eq("id", ev.id);
                setTimeline((xs) => xs.filter((x) => x.id !== ev.id));
              }}
            />
          ))}
          {timeline.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No events yet. Map your plot beats here.
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ---------- Cards ----------
function CharacterCard({
  character,
  onChange,
  onDelete,
}: {
  character: Character;
  onChange: (patch: Partial<Character>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-background/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={character.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 rounded-2xl font-medium"
          placeholder="Name"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-2xl hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Input
        value={character.role}
        onChange={(e) => onChange({ role: e.target.value })}
        placeholder="Role (e.g. Protagonist)"
        className="h-8 rounded-2xl text-xs"
      />
      <Textarea
        value={character.traits}
        onChange={(e) => onChange({ traits: e.target.value })}
        placeholder="Traits"
        className="rounded-2xl text-xs min-h-[60px]"
      />
      <Textarea
        value={character.backstory}
        onChange={(e) => onChange({ backstory: e.target.value })}
        placeholder="Backstory"
        className="rounded-2xl text-xs min-h-[80px]"
      />
    </div>
  );
}

function LoreCard({
  lore,
  onChange,
  onDelete,
}: {
  lore: Lore;
  onChange: (patch: Partial<Lore>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-background/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={lore.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="h-8 rounded-2xl font-medium"
          placeholder="Title"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-2xl hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Input
        value={lore.category}
        onChange={(e) => onChange({ category: e.target.value })}
        placeholder="Category (location, item, rule…)"
        className="h-8 rounded-2xl text-xs"
      />
      <Textarea
        value={lore.details}
        onChange={(e) => onChange({ details: e.target.value })}
        placeholder="Details"
        className="rounded-2xl text-xs min-h-[80px]"
      />
    </div>
  );
}

function TimelineRow({
  event,
  onChange,
  onDelete,
}: {
  event: TimelineEvent;
  onChange: (patch: Partial<TimelineEvent>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative pl-4 pb-4">
      <div className="absolute left-[-1px] top-2 h-3 w-3 rounded-full bg-primary border-2 border-background" />
      <div className="rounded-2xl border bg-background/60 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={event.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="h-8 rounded-2xl font-medium"
            placeholder="Event"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-2xl hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Input
          value={event.event_date}
          onChange={(e) => onChange({ event_date: e.target.value })}
          placeholder="When (e.g. Year 312)"
          className="h-8 rounded-2xl text-xs"
        />
        <Textarea
          value={event.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What happens"
          className="rounded-2xl text-xs min-h-[50px]"
        />
      </div>
    </div>
  );
}

// ---------- Feedback button ----------
function FeedbackButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"bug" | "feature">("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from("writer_feedback")
      .insert({ reporter_id: userId, kind, message: message.trim() });
    setSending(false);
    if (error) {
      toast.error("Couldn't send feedback");
      return;
    }
    toast.success("Thanks for the report!");
    setMessage("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-5 right-5 h-12 w-12 rounded-full shadow-lg z-30"
          aria-label="Send feedback"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Button
            variant={kind === "bug" ? "default" : "outline"}
            size="sm"
            className="rounded-2xl"
            onClick={() => setKind("bug")}
          >
            Bug
          </Button>
          <Button
            variant={kind === "feature" ? "default" : "outline"}
            size="sm"
            className="rounded-2xl"
            onClick={() => setKind("feature")}
          >
            Feature request
          </Button>
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what happened or what you'd love to see…"
          className="min-h-[120px] rounded-2xl"
        />
        <Button
          onClick={submit}
          disabled={sending || !message.trim()}
          className="w-full rounded-2xl"
        >
          <Send className="h-4 w-4 mr-2" /> Submit
        </Button>
      </DialogContent>
    </Dialog>
  );
}