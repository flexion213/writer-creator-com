import { useRef, useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { fixGrammar } from "@/lib/grammar.functions";
import { CloudNotebooks } from "@/components/CloudNotebooks";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  BadgeCheck, Bug, Lightbulb, Video, Upload, Send,
  NotebookPen, Globe, MessageSquare, Pencil, ImagePlus, X, Eraser, Megaphone,
  Brush, PenTool, Highlighter, SprayCan, Sparkles, Droplet, Undo2, Redo2, Download, Trash2,
  ShieldAlert, Crown,
  Plus, Wand2, Loader2, Search, Heart, MessageCircle, Menu,
} from "lucide-react";
import Wheel from "@uiw/react-color-wheel";
import ShadeSlider from "@uiw/react-color-shade-slider";
import Alpha from "@uiw/react-color-alpha";
import { hsvaToHex, hsvaToRgba, hexToHsva, type HsvaColor } from "@uiw/color-convert";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dev Dashboard" },
      { name: "description", content: "Lightweight single-screen developer dashboard." },
    ],
  }),
});

type Post = {
  id: string;
  author_id: string;
  author: string;
  verified: boolean;
  title?: string;
  text: string;
  image?: string;
  created_at: string;
};
type Comment = { id: string; author: string; text: string; ts: number };
type Section = "feed" | "notebooks" | "suggestions" | "drawing";
type Notebook = { id: number; title: string; body: string; updated: number };
type SuggestionDrafts = {
  bugTitle: string;
  bugBody: string;
  featureTitle: string;
  featureBody: string;
  videoTitle: string;
  videoBody: string;
  userTarget: string;
  userBody: string;
};

const emptySuggestionDrafts: SuggestionDrafts = {
  bugTitle: "",
  bugBody: "",
  featureTitle: "",
  featureBody: "",
  videoTitle: "",
  videoBody: "",
  userTarget: "",
  userBody: "",
};

const initialPosts: Post[] = [];

const BOT_AUTHOR_PATTERNS = [
  /ada lovelace/i,
  /linus/i,
  /head dev/i,
  /anonymous/i,
  /bot/i,
  /mock/i,
  /test user/i,
];

function isRealPostCandidate(post: unknown): post is Post {
  if (!post || typeof post !== "object") return false;
  const candidate = post as Partial<Post>;
  if (typeof candidate.id !== "number") return false;
  if (typeof candidate.author !== "string") return false;
  if (typeof candidate.text !== "string") return false;

  const author = candidate.author.trim();
  if (!author) return false;
  if (BOT_AUTHOR_PATTERNS.some((pattern) => pattern.test(author))) return false;

  return true;
}

function sanitizeStoredPosts(posts: unknown): Post[] {
  if (!Array.isArray(posts)) return [];

  return posts
    .filter(isRealPostCandidate)
    .map((post) => ({
      id: post.id,
      author: post.author.trim(),
      verified: !!post.verified,
      title: typeof post.title === "string" && post.title.trim() ? post.title.trim() : undefined,
      text: post.text,
      image: typeof post.image === "string" && post.image.trim() ? post.image : undefined,
    }));
}

const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "feed", label: "Global Feed", icon: Globe },
  { id: "notebooks", label: "My Private Notebooks", icon: NotebookPen },
  { id: "suggestions", label: "Suggestions Box", icon: MessageSquare },
  { id: "drawing", label: "Drawing Studio", icon: Pencil },
];

function Dashboard() {
  const { isAdmin, isModerator, profile, user } = useAuth();
  const currentUsername =
    profile?.username ||
    profile?.display_name ||
    user?.email?.split("@")[0] ||
    "anonymous";
  const navigate = useNavigate();
  // IMPORTANT: All state below uses the same defaults on the server and the
  // client's first render to avoid hydration mismatches. localStorage is
  // read AFTER mount via the `hydrated` effect below.
  const DEFAULT_BROADCAST =
    "v2.4 ships Friday. Freeze new feature merges until QA signs off. — Head Dev";
  const [hydrated, setHydrated] = useState(false);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftImage, setDraftImage] = useState<string | undefined>(undefined);
  const [section, setSection] = useState<Section>("feed");
  const [navOpen, setNavOpen] = useState(false);
  const [draftFixing, setDraftFixing] = useState(false);
  const adminMode = isAdmin;
  const [suggestions, setSuggestions] = useState<SuggestionDrafts>(emptySuggestionDrafts);
  const [broadcast, setBroadcast] = useState(DEFAULT_BROADCAST);
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const fix = useServerFn(fixGrammar);

  // One-time hydration from localStorage (client only, after mount).
  useEffect(() => {
    try {
      const rawPosts = window.localStorage.getItem("dd:posts");
      if (rawPosts) {
        const sanitizedPosts = sanitizeStoredPosts(JSON.parse(rawPosts));
        setPosts(sanitizedPosts);
        window.localStorage.setItem("dd:posts", JSON.stringify(sanitizedPosts));
      }
      const rawDraft = window.localStorage.getItem("dd:post-draft");
      if (rawDraft) setDraft(rawDraft);
      const rawImg = window.localStorage.getItem("dd:post-draft-image");
      if (rawImg) setDraftImage(rawImg);
      const savedSection = window.localStorage.getItem("dd:section");
      if (savedSection === "feed" || savedSection === "notebooks" || savedSection === "suggestions" || savedSection === "drawing") {
        setSection(savedSection);
      }
      const rawSug = window.localStorage.getItem("dd:suggestions");
      if (rawSug) setSuggestions({ ...emptySuggestionDrafts, ...(JSON.parse(rawSug) as Partial<SuggestionDrafts>) });
      const rawBroadcast = window.localStorage.getItem("dd:broadcast");
      if (rawBroadcast) setBroadcast(rawBroadcast);
      const rawNb = window.localStorage.getItem("dd:notebooks");
      if (rawNb) setNotebooks(JSON.parse(rawNb) as Notebook[]);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("dd:posts", JSON.stringify(posts)); } catch {}
  }, [posts, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("dd:notebooks", JSON.stringify(notebooks)); } catch {}
  }, [notebooks, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("dd:post-draft", draft); } catch {}
  }, [draft, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (draftImage) window.localStorage.setItem("dd:post-draft-image", draftImage);
      else window.localStorage.removeItem("dd:post-draft-image");
    } catch {}
  }, [draftImage, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("dd:section", section); } catch {}
  }, [section, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("dd:suggestions", JSON.stringify(suggestions)); } catch {}
  }, [suggestions, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("dd:broadcast", broadcast); } catch {}
  }, [broadcast, hydrated]);

  const runFix = async (text: string): Promise<string | null> => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Nothing to fix yet — write something first.");
      return null;
    }
    try {
      const r = await fix({ data: { text: trimmed } });
      if (!r.ok) { toast.error(r.error); return null; }
      toast.success(`Fixed (${r.language})`);
      return r.corrected;
    } catch (e) {
      toast.error("Couldn't reach the grammar assistant.");
      return null;
    }
  };

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const charCount = draft.length;

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setDraftImage(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(f);
  };

  const submitPost = () => {
    const text = draft.trim();
    const title = draftTitle.trim();
    if (!text && !draftImage && !title) return;
    setPosts((p) => [{
      id: Date.now(),
      author: adminMode ? "Head Dev" : currentUsername,
      verified: adminMode,
      title: title || undefined,
      text,
      image: draftImage,
    }, ...p]);
    setDraft("");
    setDraftTitle("");
    setDraftImage(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const go = (s: Section) => { setSection(s); setNavOpen(false); };
  const currentLabel = NAV.find((n) => n.id === section)?.label ?? "Global Feed";

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Toaster />
      {/* Menu sheet always mounted so the feed reel can open it imperatively */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-80 border-r-0 bg-gradient-to-b from-background to-background/95">
          <SheetHeader className="text-left">
            <SheetTitle style={{ color: "#FFFFD7" }} className="text-2xl font-bold tracking-tight">
              Dev Dashboard
            </SheetTitle>
            <p className="text-xs text-muted-foreground">Jump to a section</p>
          </SheetHeader>
          <nav className="mt-6 space-y-2">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = section === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all ${
                    active
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "hover:bg-accent/40 hover:translate-x-0.5"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      active ? "bg-background/60" : "bg-accent/40 group-hover:bg-accent/70"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-base font-medium tracking-tight">{n.label}</span>
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {section === "feed" && (
        <FeedReel
          posts={posts}
          currentUsername={currentUsername}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenMenu={() => setNavOpen(true)}
          broadcast={broadcast}
          setBroadcast={setBroadcast}
          adminMode={adminMode}
          draft={draft}
          setDraft={setDraft}
          draftTitle={draftTitle}
          setDraftTitle={setDraftTitle}
          draftImage={draftImage}
          setDraftImage={setDraftImage}
          fileRef={fileRef}
          onPickImage={onPickImage}
          submitPost={submitPost}
          runFix={runFix}
          draftFixing={draftFixing}
          setDraftFixing={setDraftFixing}
        />
      )}

      {section !== "feed" && (
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9" onClick={() => setNavOpen(true)}>
            <div className="flex flex-col gap-[5px]">
              <span className="block h-[2px] w-5 bg-foreground" />
              <span className="block h-[2px] w-5 bg-foreground" />
              <span className="block h-[2px] w-5 bg-foreground" />
            </div>
          </Button>
          {false && (
              <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9">
                <div className="flex flex-col gap-[5px]">
                  <span className="block h-[2px] w-5 bg-foreground" />
                  <span className="block h-[2px] w-5 bg-foreground" />
                  <span className="block h-[2px] w-5 bg-foreground" />
                </div>
              </Button>
          )}

          <h1
            style={{ color: "#FFFFD7" }}
            className="flex-1 text-center text-xl font-bold tracking-tight select-none cursor-default"
          >
            Dev Dashboard
          </h1>
          <div className="w-9" />
        </div>

        <p className="text-center text-[11px] text-muted-foreground -mt-2">
          {currentLabel}
        </p>

        {section === "notebooks" && (
          <CloudNotebooks runFix={runFix} />
        )}
        {section === "suggestions" && <Suggestions suggestions={suggestions} setSuggestions={setSuggestions} />}
        {section === "drawing" && <DrawingStudio adminMode={adminMode} />}
      </main>
      )}

      {(isAdmin || isModerator) && (
        <button
          type="button"
          onClick={() => navigate({ to: isAdmin ? "/admin" : "/admin/reports" })}
          aria-label={isAdmin ? "Admin dashboard" : "Reports"}
          className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full opacity-20 hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg"
          style={{
            background: "radial-gradient(circle at 30% 30%, #FFE680, #C9A227 60%, #7A5A0F)",
            boxShadow: "0 0 18px rgba(255, 215, 80, 0.45)",
          }}
        >
          <Crown className="h-5 w-5 text-black/80" />
        </button>
      )}
    </div>
  );
}

function Notebooks({
  notebooks,
  setNotebooks,
  runFix,
}: {
  notebooks: Notebook[];
  setNotebooks: React.Dispatch<React.SetStateAction<Notebook[]>>;
  runFix: (text: string) => Promise<string | null>;
}) {
  const [fixingId, setFixingId] = useState<number | null>(null);

  const addNotebook = () => {
    const id = Date.now();
    setNotebooks((n) => [{ id, title: "Untitled", body: "", updated: id }, ...n]);
  };
  const update = (id: number, patch: Partial<Notebook>) =>
    setNotebooks((n) => n.map((nb) => (nb.id === id ? { ...nb, ...patch, updated: Date.now() } : nb)));
  const remove = (id: number) => setNotebooks((n) => n.filter((nb) => nb.id !== id));

  const fmt = (t: number) => {
    const d = Math.max(1, Math.floor((Date.now() - t) / 60000));
    if (d < 60) return `${d}m ago`;
    if (d < 60 * 24) return `${Math.floor(d / 60)}h ago`;
    return `${Math.floor(d / 60 / 24)}d ago`;
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
            <p className="text-xs text-muted-foreground">Private scratchpad with AI grammar fix.</p>
          </div>
        </div>
        <Button size="sm" onClick={addNotebook} className="rounded-full">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      {notebooks.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <NotebookPen className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No notebooks yet</p>
          <p className="text-xs text-muted-foreground">Tap “New” to start one.</p>
        </Card>
      )}

      <div className="space-y-3">
        {notebooks.map((nb) => {
          const fixing = fixingId === nb.id;
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
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(nb.id)}
                    aria-label="Delete notebook"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={nb.body}
                  onChange={(e) => update(nb.id, { body: e.target.value })}
                  placeholder="Start writing…"
                  className="min-h-24 resize-none border-0 bg-muted/30 rounded-lg focus-visible:ring-1"
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {fmt(nb.updated)} · {nb.body.length} ch
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!nb.body.trim() || fixing}
                    onClick={async () => {
                      setFixingId(nb.id);
                      const fixed = await runFix(nb.body);
                      if (fixed) update(nb.id, { body: fixed });
                      setFixingId(null);
                    }}
                    className="rounded-full"
                  >
                    {fixing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                    Fix grammar
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Suggestions({
  suggestions,
  setSuggestions,
}: {
  suggestions: SuggestionDrafts;
  setSuggestions: React.Dispatch<React.SetStateAction<SuggestionDrafts>>;
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const submit = async (
    kind: "bug" | "feature" | "video" | "user",
    title: string,
    body: string,
    reportedUsername?: string,
    resetKeys?: (keyof SuggestionDrafts)[],
  ) => {
    if (!user) { toast.error("Please sign in to submit."); return; }
    if (!title.trim()) { toast.error("Add a title first."); return; }
    setSubmitting(kind);
    let reportedUserId: string | null = null;
    if (kind === "user" && reportedUsername?.trim()) {
      const { data: p } = await supabase
        .from("profiles").select("id")
        .ilike("username", reportedUsername.trim().replace(/^@/, ""))
        .maybeSingle();
      reportedUserId = p?.id ?? null;
      if (!reportedUserId) {
        setSubmitting(null);
        toast.error("User not found.");
        return;
      }
    }
    const { error } = await supabase.from("reports").insert({
      kind, title: title.trim(), body: body.trim(),
      reporter_id: user.id, reported_user_id: reportedUserId,
    });
    setSubmitting(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted — staff will review.");
    if (resetKeys) {
      setSuggestions((cur) => {
        const next = { ...cur };
        for (const k of resetKeys) next[k] = "" as never;
        return next;
      });
    }
  };

  return (
    <div className="space-y-2">
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Bug className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium">Bug Reports</p>
        </div>
        <Input
          placeholder="Title"
          className="mb-2"
          value={suggestions.bugTitle}
          onChange={(e) => setSuggestions((current) => ({ ...current, bugTitle: e.target.value }))}
        />
        <Textarea
          placeholder="Steps to reproduce…"
          className="mb-2 min-h-16 resize-none"
          value={suggestions.bugBody}
          onChange={(e) => setSuggestions((current) => ({ ...current, bugBody: e.target.value }))}
        />
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="text-xs">
            <Upload className="h-3.5 w-3.5 mr-1" /> Attach
          </Button>
          <Button size="sm" disabled={submitting === "bug"} onClick={() => submit("bug", suggestions.bugTitle, suggestions.bugBody, undefined, ["bugTitle","bugBody"])}>
            {submitting === "bug" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit"}
          </Button>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Feature Suggestions</p>
        </div>
        <Input
          placeholder="Idea title"
          className="mb-2"
          value={suggestions.featureTitle}
          onChange={(e) => setSuggestions((current) => ({ ...current, featureTitle: e.target.value }))}
        />
        <Textarea
          placeholder="Describe the feature…"
          className="mb-2 min-h-16 resize-none"
          value={suggestions.featureBody}
          onChange={(e) => setSuggestions((current) => ({ ...current, featureBody: e.target.value }))}
        />
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="text-xs">
            <Upload className="h-3.5 w-3.5 mr-1" /> Attach mockup
          </Button>
          <Button size="sm" disabled={submitting === "feature"} onClick={() => submit("feature", suggestions.featureTitle, suggestions.featureBody, undefined, ["featureTitle","featureBody"])}>
            {submitting === "feature" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit"}
          </Button>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Video className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Video / Media Bug Reports</p>
        </div>
        <Input
          placeholder="What broke?"
          className="mb-2"
          value={suggestions.videoTitle}
          onChange={(e) => setSuggestions((current) => ({ ...current, videoTitle: e.target.value }))}
        />
        <Textarea
          placeholder="Context (timestamp, device, etc.)"
          className="mb-2 min-h-16 resize-none"
          value={suggestions.videoBody}
          onChange={(e) => setSuggestions((current) => ({ ...current, videoBody: e.target.value }))}
        />
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" className="text-xs">
            <Upload className="h-3.5 w-3.5 mr-1" /> Attach video
          </Button>
          <Button size="sm" disabled={submitting === "video"} onClick={() => submit("video", suggestions.videoTitle, suggestions.videoBody, undefined, ["videoTitle","videoBody"])}>
            {submitting === "video" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit"}
          </Button>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium">Report a User</p>
        </div>
        <Input
          placeholder="Username (e.g. alice)"
          className="mb-2"
          value={suggestions.userTarget}
          onChange={(e) => setSuggestions((current) => ({ ...current, userTarget: e.target.value }))}
        />
        <Textarea
          placeholder="What happened? Be specific."
          className="mb-2 min-h-16 resize-none"
          value={suggestions.userBody}
          onChange={(e) => setSuggestions((current) => ({ ...current, userBody: e.target.value }))}
        />
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            disabled={submitting === "user"}
            onClick={() => submit("user", `Report: @${suggestions.userTarget.trim().replace(/^@/, "")}`, suggestions.userBody, suggestions.userTarget, ["userTarget","userBody"])}
          >
            {submitting === "user" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

type BrushId = "pencil" | "pen" | "marker" | "ink" | "highlighter" | "airbrush" | "spray" | "neon" | "calligraphy" | "eraser";

const BRUSHES: { id: BrushId; label: string; icon: React.ComponentType<{ className?: string }>; defaultSize: number; defaultOpacity: number }[] = [
  { id: "pencil",      label: "Pencil",      icon: Pencil,      defaultSize: 2,  defaultOpacity: 0.85 },
  { id: "pen",         label: "Pen",         icon: PenTool,     defaultSize: 4,  defaultOpacity: 1 },
  { id: "marker",      label: "Marker",      icon: Brush,       defaultSize: 10, defaultOpacity: 0.9 },
  { id: "ink",         label: "Ink",         icon: Droplet,     defaultSize: 6,  defaultOpacity: 1 },
  { id: "highlighter", label: "Highlighter", icon: Highlighter, defaultSize: 18, defaultOpacity: 0.35 },
  { id: "airbrush",    label: "Airbrush",    icon: SprayCan,    defaultSize: 24, defaultOpacity: 0.15 },
  { id: "spray",       label: "Spray",       icon: SprayCan,    defaultSize: 22, defaultOpacity: 0.6 },
  { id: "neon",        label: "Neon",        icon: Sparkles,    defaultSize: 6,  defaultOpacity: 1 },
  { id: "calligraphy", label: "Calligraphy", icon: PenTool,     defaultSize: 14, defaultOpacity: 1 },
  { id: "eraser",      label: "Eraser",      icon: Eraser,      defaultSize: 18, defaultOpacity: 1 },
];

const PREMIUM_BRUSHES: BrushId[] = ["neon", "spray"];

function DrawingStudio({ adminMode }: { adminMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hsva, setHsva] = useState<HsvaColor>(() => {
    if (typeof window === "undefined") return hexToHsva("#FFFFD7");
    const saved = window.localStorage.getItem("dd:drawing-color");
    return saved ? hexToHsva(saved) : hexToHsva("#FFFFD7");
  });
  const [brush, setBrush] = useState<BrushId>(() => {
    if (typeof window === "undefined") return "pen";
    const saved = window.localStorage.getItem("dd:drawing-brush");
    return BRUSHES.some((item) => item.id === saved) ? (saved as BrushId) : "pen";
  });
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return 4;
    return Number(window.localStorage.getItem("dd:drawing-size") ?? 4);
  });
  const [opacity, setOpacity] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem("dd:drawing-opacity") ?? 1);
    return Number.isFinite(saved) ? saved : 1;
  });
  const [showColor, setShowColor] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("dd:drawing-show-color") === "true";
  });

  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<ImageData[]>([]);
  const future = useRef<ImageData[]>([]);
  const sprayTimer = useRef<number | null>(null);

  const fillBg = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const persist = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    try { window.localStorage.setItem("dd:canvas", c.toDataURL("image/png")); } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("dd:drawing-color", hsvaToHex(hsva));
      window.localStorage.setItem("dd:drawing-brush", brush);
      window.localStorage.setItem("dd:drawing-size", String(size));
      window.localStorage.setItem("dd:drawing-opacity", String(opacity));
      window.localStorage.setItem("dd:drawing-show-color", String(showColor));
    } catch {}
  }, [brush, hsva, opacity, showColor, size]);

  // Load saved drawing or paint background on mount
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("dd:canvas") : null;
    if (saved) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, c.width, c.height); };
      img.src = saved;
    } else {
      fillBg();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync brush defaults
  const selectBrush = (id: BrushId) => {
    if (PREMIUM_BRUSHES.includes(id) && !adminMode) {
      toast.error("Premium brush — unlock for €3 (coming soon).");
      return;
    }
    setBrush(id);
    const b = BRUSHES.find((x) => x.id === id)!;
    setSize(b.defaultSize);
    setOpacity(b.defaultOpacity);
  };

  const snapshot = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    history.current.push(ctx.getImageData(0, 0, c.width, c.height));
    if (history.current.length > 25) history.current.shift();
    future.current = [];
  };

  const undo = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const last = history.current.pop();
    if (!last) return;
    future.current.push(ctx.getImageData(0, 0, c.width, c.height));
    ctx.putImageData(last, 0, 0);
  };
  const redo = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const next = future.current.pop();
    if (!next) return;
    history.current.push(ctx.getImageData(0, 0, c.width, c.height));
    ctx.putImageData(next, 0, 0);
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  const applyStroke = (ctx: CanvasRenderingContext2D) => {
    const hex = hsvaToHex(hsva);
    const rgba = hsvaToRgba(hsva);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = hex;
    ctx.fillStyle = `rgba(${rgba.r},${rgba.g},${rgba.b},${opacity})`;
    ctx.lineWidth = size;

    switch (brush) {
      case "pencil":
        ctx.globalAlpha = opacity * 0.9;
        ctx.lineWidth = Math.max(1, size * 0.6);
        break;
      case "marker":
        ctx.lineWidth = size;
        break;
      case "ink":
        ctx.lineWidth = size;
        break;
      case "highlighter":
        ctx.lineCap = "butt";
        ctx.lineWidth = size * 1.2;
        break;
      case "neon":
        ctx.shadowBlur = size * 2.5;
        ctx.shadowColor = hex;
        break;
      case "calligraphy":
        ctx.lineCap = "butt";
        break;
      case "eraser":
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#0a0a0a";
        ctx.fillStyle = "#0a0a0a";
        ctx.globalAlpha = 1;
        break;
    }
  };

  const drawSegment = (ctx: CanvasRenderingContext2D, from: {x:number;y:number}, to: {x:number;y:number}) => {
    if (brush === "calligraphy") {
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w = size / 2;
      ctx.beginPath();
      ctx.moveTo(from.x + nx * w, from.y + ny * w);
      ctx.lineTo(to.x + nx * w, to.y + ny * w);
      ctx.lineTo(to.x - nx * w * 0.3, to.y - ny * w * 0.3);
      ctx.lineTo(from.x - nx * w * 0.3, from.y - ny * w * 0.3);
      ctx.closePath();
      ctx.fill();
      return;
    }
    if (brush === "spray") {
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.floor(dist / 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = from.x + (to.x - from.x) * t;
        const cy = from.y + (to.y - from.y) * t;
        for (let j = 0; j < 8; j++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * size;
          ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1);
        }
      }
      return;
    }
    if (brush === "airbrush") {
      // soft radial dab along the path
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.floor(dist / 3));
      const rgba = hsvaToRgba(hsva);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const cx = from.x + (to.x - from.x) * t;
        const cy = from.y + (to.y - from.y) * t;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
        grad.addColorStop(0, `rgba(${rgba.r},${rgba.g},${rgba.b},${opacity})`);
        grad.addColorStop(1, `rgba(${rgba.r},${rgba.g},${rgba.b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    snapshot();
    const ctx = canvasRef.current!.getContext("2d")!;
    applyStroke(ctx);
    const p = pos(e);
    lastPt.current = p;
    // initial dot
    drawSegment(ctx, p, { x: p.x + 0.01, y: p.y + 0.01 });
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !lastPt.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    applyStroke(ctx);
    const p = pos(e);
    drawSegment(ctx, lastPt.current, p);
    lastPt.current = p;
  };
  const end = () => {
    drawing.current = false;
    lastPt.current = null;
    if (sprayTimer.current) { window.clearInterval(sprayTimer.current); sprayTimer.current = null; }
    persist();
  };

  const clear = () => { snapshot(); fillBg(); persist(); };

  const save = () => {
    const c = canvasRef.current!;
    const link = document.createElement("a");
    link.download = `drawing-${Date.now()}.png`;
    link.href = c.toDataURL("image/png");
    link.click();
  };

  const swatches = ["#FFFFD7","#FFFFFF","#000000","#EF4444","#F97316","#EAB308","#22C55E","#06B6D4","#3B82F6","#A855F7","#EC4899","#78350F"];
  const currentHex = hsvaToHex(hsva);

  return (
    <Card className="p-3 space-y-3">
      {/* Brush palette */}
      <div className="grid grid-cols-5 gap-1.5">
        {BRUSHES.map((b) => {
          const Icon = b.icon;
          const active = brush === b.id;
          const locked = PREMIUM_BRUSHES.includes(b.id) && !adminMode;
          return (
            <button
              key={b.id}
              onClick={() => selectBrush(b.id)}
              title={locked ? `${b.label} — Premium (€3)` : b.label}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg p-2 text-[10px] transition-colors ${
                active ? "bg-accent text-accent-foreground ring-1 ring-primary/60" : "bg-accent/30 hover:bg-accent/60"
              } ${locked ? "opacity-60" : ""}`}
            >
              <Icon className="h-4 w-4" />
              <span className="leading-none">{b.label}</span>
              {locked && (
                <span className="absolute -top-1 -right-1 rounded-full bg-primary text-primary-foreground text-[8px] px-1 leading-none py-0.5">
                  €3
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Color + sliders */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => setShowColor((s) => !s)}
          className="h-12 w-12 shrink-0 rounded-full border-2 border-border shadow-inner"
          style={{ background: currentHex }}
          aria-label="Toggle color wheel"
        />
        <div className="flex-1 space-y-2">
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Size</span><span>{size}px</span>
            </div>
            <input type="range" min={1} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Opacity</span><span>{Math.round(opacity * 100)}%</span>
            </div>
            <input type="range" min={5} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="w-full accent-primary" />
          </div>
        </div>
      </div>

      {/* Color wheel panel */}
      {showColor && (
        <div className="rounded-lg border bg-card/60 p-3 space-y-2">
          <div className="flex justify-center">
            <Wheel color={hsva} onChange={(c) => setHsva({ ...hsva, ...c.hsva })} width={180} height={180} />
          </div>
          <ShadeSlider hsva={hsva} onChange={(s) => setHsva({ ...hsva, ...s })} style={{ width: "100%" }} />
          <Alpha hsva={hsva} onChange={(a) => setHsva({ ...hsva, ...a })} style={{ width: "100%", height: 14 }} />
          <div className="grid grid-cols-6 gap-1.5 pt-1">
            {swatches.map((s) => (
              <button
                key={s}
                onClick={() => setHsva(hexToHsva(s))}
                className="h-7 rounded-md border border-border"
                style={{ background: s }}
                aria-label={s}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={undo}><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={redo}><Redo2 className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={save}><Download className="h-3.5 w-3.5 mr-1" /> Save</Button>
          <Button size="sm" variant="outline" onClick={clear}><Trash2 className="h-3.5 w-3.5 mr-1" /> Clear</Button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={1400}
        height={1800}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        className="w-full rounded-md border border-border touch-none bg-[#0a0a0a]"
        style={{ aspectRatio: "1400 / 1800" }}
      />
      <p className="text-[10px] text-muted-foreground text-center">Drag to draw · auto-saved on this device</p>
    </Card>
  );
}

// ============== TikTok-style vertical scroll-snap feed ==============

type FeedReelProps = {
  posts: Post[];
  currentUsername: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenMenu: () => void;
  broadcast: string;
  setBroadcast: (s: string) => void;
  adminMode: boolean;
  draft: string;
  setDraft: (s: string) => void;
  draftTitle: string;
  setDraftTitle: (s: string) => void;
  draftImage: string | undefined;
  setDraftImage: (s: string | undefined) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPickImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  submitPost: () => void;
  runFix: (text: string) => Promise<string | null>;
  draftFixing: boolean;
  setDraftFixing: (b: boolean) => void;
};

function FeedReel(props: FeedReelProps) {
  const {
    posts, currentUsername, searchQuery, setSearchQuery, onOpenMenu,
    broadcast, setBroadcast, adminMode,
    draft, setDraft, draftTitle, setDraftTitle,
    draftImage, setDraftImage, fileRef, onPickImage,
    submitPost, runFix, draftFixing, setDraftFixing,
  } = props;

  const [likes, setLikes] = useState<Record<number, number>>({});
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [feedHydrated, setFeedHydrated] = useState(false);
  const [openCommentsFor, setOpenCommentsFor] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [activePostId, setActivePostId] = useState<number | null>(null);

  // Hydrate likes/comments from localStorage (once, on mount)
  useEffect(() => {
    try {
      const rl = window.localStorage.getItem("dd:likes");
      if (rl) setLikes(JSON.parse(rl));
      const rk = window.localStorage.getItem("dd:liked");
      if (rk) setLiked(JSON.parse(rk));
      const rc = window.localStorage.getItem("dd:comments");
      if (rc) setComments(JSON.parse(rc));
    } catch {}
    setFeedHydrated(true);
  }, []);
  useEffect(() => {
    if (!feedHydrated) return;
    try { window.localStorage.setItem("dd:likes", JSON.stringify(likes)); } catch {}
  }, [likes, feedHydrated]);
  useEffect(() => {
    if (!feedHydrated) return;
    try { window.localStorage.setItem("dd:liked", JSON.stringify(liked)); } catch {}
  }, [liked, feedHydrated]);
  useEffect(() => {
    if (!feedHydrated) return;
    try { window.localStorage.setItem("dd:comments", JSON.stringify(comments)); } catch {}
  }, [comments, feedHydrated]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? posts.filter(
        (p) =>
          p.author.toLowerCase().includes(q) ||
          (p.title ?? "").toLowerCase().includes(q) ||
          p.text.toLowerCase().includes(q),
      )
    : posts;

  const toggleLike = (id: number) => {
    setLiked((l) => {
      const wasLiked = !!l[id];
      setLikes((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + (wasLiked ? -1 : 1)) }));
      return { ...l, [id]: !wasLiked };
    });
  };

  const addComment = (id: number) => {
    const t = commentDraft.trim();
    if (!t) return;
    const entry: Comment = { author: currentUsername, text: t, ts: Date.now() };
    setComments((c) => ({ ...c, [id]: [...(c[id] ?? []), entry] }));
    setCommentDraft("");
  };

  // Shared glass panel classes
  const glass =
    "rounded-[20px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]";

  const activePost = activePostId !== null ? filtered.find((p) => p.id === activePostId) : null;

  useEffect(() => {
    if (filtered.length === 0) {
      setActivePostId(null);
      return;
    }

    if (activePostId === null || !filtered.some((post) => post.id === activePostId)) {
      setActivePostId(filtered[0].id);
    }
  }, [filtered, activePostId]);

  return (
    <div
      className="fixed inset-0 z-30 overflow-hidden text-foreground"
      style={{
        background:
          "linear-gradient(180deg, #050505 0%, #0d0d10 50%, #050505 100%)",
      }}
    >
      {/* Top translucent overlay: menu + search */}
      <div
        className="absolute top-0 left-0 right-0 z-40 flex items-center gap-2 px-3 pt-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open menu"
          className={`${glass} h-11 w-11 shrink-0 flex items-center justify-center text-white/90`}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className={`${glass} relative flex-1 h-11 flex items-center`}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search #tags or @users"
            className="w-full h-full bg-transparent pl-10 pr-4 text-sm text-white placeholder:text-white/50 outline-none rounded-[20px]"
          />
        </div>
      </div>

      {/* Snap container */}
      <div
        className="h-full w-full overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Composer slide */}
        <FeedSlide postId={null} onActive={setActivePostId}>
          <div className={`${glass} w-full max-w-sm p-5`}>
            <p className="text-xs uppercase tracking-widest text-white/60 mb-3">
              Share a story
            </p>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Title (optional)"
              className="rounded-[20px] bg-white/5 border-white/10 text-white placeholder:text-white/40 font-semibold"
              maxLength={120}
            />
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What's the story?"
              className="mt-2 min-h-28 resize-none rounded-[20px] bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
            {draftImage && (
              <div className="relative mt-2">
                <img src={draftImage} alt="" className="rounded-[20px] max-h-48 w-full object-cover" />
                <button
                  onClick={() => { setDraftImage(undefined); if (fileRef.current) fileRef.current.value = ""; }}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center"
                  aria-label="Remove image"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickImage}
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`${glass} h-10 px-3 flex items-center gap-1.5 text-xs text-white/90`}
              >
                <ImagePlus className="h-4 w-4" /> Photo
              </button>
              <button
                type="button"
                disabled={!draft.trim() || draftFixing}
                onClick={async () => {
                  setDraftFixing(true);
                  const fixed = await runFix(draft);
                  if (fixed) setDraft(fixed);
                  setDraftFixing(false);
                }}
                className={`${glass} h-10 px-3 flex items-center gap-1.5 text-xs text-white/90 disabled:opacity-40`}
              >
                {draftFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Fix
              </button>
              <button
                type="button"
                onClick={submitPost}
                disabled={!draft.trim() && !draftImage && !draftTitle.trim()}
                className="ml-auto h-10 px-4 rounded-[20px] bg-white text-black text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> Post
              </button>
            </div>
            <p className="mt-4 text-center text-[11px] text-white/40">
              Swipe up to explore stories
            </p>
          </div>
        </FeedSlide>

        {/* Broadcast slide */}
        {broadcast.trim() && (
          <FeedSlide postId={null} onActive={setActivePostId}>
            <div className={`${glass} w-full max-w-sm p-5`}>
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="h-4 w-4 text-red-400" />
                <span className="text-[10px] uppercase tracking-widest text-red-300/80">
                  Lead Dev Broadcast
                </span>
              </div>
              <Textarea
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                className="min-h-32 resize-none rounded-[20px] bg-transparent border-0 p-0 text-white text-base focus-visible:ring-0"
              />
              {adminMode && (
                <div className="mt-4 flex items-center gap-2 text-[11px] text-white/50">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Admin mode: your posts publish as Head Dev.
                </div>
              )}
            </div>
          </FeedSlide>
        )}

        {/* Posts */}
        {filtered.length === 0 && q ? (
          <FeedSlide postId={null} onActive={setActivePostId}>
            <div className={`${glass} w-full max-w-sm p-6 text-center`}>
              <p className="text-white/70 text-sm">No stories match “{searchQuery}”.</p>
            </div>
          </FeedSlide>
        ) : (
          filtered.map((p) => (
            <FeedSlide key={p.id} postId={p.id} onActive={setActivePostId}>
              <FeedPostCard post={p} glass={glass} />
            </FeedSlide>
          ))
        )}
      </div>

      {/* Single fixed interaction bar — tracks the currently visible post */}
      {activePost && (
        <div
          className="fixed right-3 z-40 flex flex-col items-center gap-3"
          style={{ bottom: "max(6rem, calc(env(safe-area-inset-bottom) + 5rem))" }}
        >
          <button
            type="button"
            onClick={() => toggleLike(activePost.id)}
            aria-label="Like"
            className={`${glass} h-12 w-12 flex items-center justify-center transition-transform active:scale-90`}
          >
            <Heart
              className={`h-6 w-6 transition-colors ${liked[activePost.id] ? "text-rose-500 fill-rose-500" : "text-white"}`}
            />
          </button>
          <span className="text-xs font-semibold text-white/90 -mt-1">
            {likes[activePost.id] ?? 0}
          </span>
          <button
            type="button"
            onClick={() => setOpenCommentsFor(activePost.id)}
            aria-label="Comments"
            className={`${glass} h-12 w-12 flex items-center justify-center transition-transform active:scale-90`}
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </button>
          <span className="text-xs font-semibold text-white/90 -mt-1">
            {(comments[activePost.id] ?? []).length}
          </span>
        </div>
      )}

      {/* Comments sheet */}
      <Sheet open={openCommentsFor !== null} onOpenChange={(o) => !o && setOpenCommentsFor(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-[24px] border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl text-white h-[70vh] flex flex-col"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-white">Comments</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {(openCommentsFor !== null ? comments[openCommentsFor] ?? [] : []).map((c, i) => (
              <div key={i} className="rounded-[20px] bg-white/5 border border-white/10 px-3 py-2 text-sm">
                <p className="text-[11px] font-semibold text-white/70">@{c.author}</p>
                <p className="text-white/90 whitespace-pre-wrap">{c.text}</p>
              </div>
            ))}
            {openCommentsFor !== null && (comments[openCommentsFor] ?? []).length === 0 && (
              <p className="text-center text-sm text-white/50 py-6">Be the first to comment.</p>
            )}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <span className="text-[11px] text-white/50 shrink-0 pl-1">@{currentUsername}</span>
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Add a comment…"
              onKeyDown={(e) => { if (e.key === "Enter" && openCommentsFor !== null) addComment(openCommentsFor); }}
              className="flex-1 h-11 rounded-[20px] bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-white/40 outline-none"
            />
            <button
              onClick={() => openCommentsFor !== null && addComment(openCommentsFor)}
              className="h-11 px-4 rounded-[20px] bg-white text-black text-sm font-semibold"
            >
              Send
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FeedSlide({
  children,
  postId,
  onActive,
}: {
  children: React.ReactNode;
  postId?: number | null;
  onActive?: (id: number | null) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (postId === undefined || !onActive || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) onActive(postId);
        }
      },
      { threshold: [0.6] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [postId, onActive]);
  return (
    <section
      ref={ref}
      className="relative w-full flex items-center justify-center px-4"
      style={{ height: "100vh", scrollSnapAlign: "start", scrollSnapStop: "always" }}
    >
      {children}
    </section>
  );
}

function FeedPostCard({ post, glass }: { post: Post; glass: string }) {
  return (
    <article
      className={`${glass} relative w-full max-w-sm overflow-y-auto p-5 pr-20 animate-fade-in`}
      style={{
        maxHeight: "calc(100vh - 8rem)",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "thin",
      }}
      onWheelCapture={(e) => e.stopPropagation()}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-white/30 to-white/5 border border-white/10" />
          <p className="text-sm font-medium text-white ml-1">{post.author}</p>
          {post.verified && <BadgeCheck className="h-3.5 w-3.5 text-sky-400" />}
        </div>
        {post.title && (
          <h2 className="mt-3 text-xl font-semibold leading-tight text-white">{post.title}</h2>
        )}
        {post.text && (
          <p className="mt-2 text-[15px] leading-relaxed text-white/85 whitespace-pre-wrap">{post.text}</p>
        )}
        {post.image && (
          <img
            src={post.image}
            alt=""
            className="mt-3 rounded-[20px] w-full max-h-[45vh] object-cover border border-white/10"
          />
        )}
    </article>
  );
}
