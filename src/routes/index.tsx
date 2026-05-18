import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  BadgeCheck, Bug, Lightbulb, Video, Upload, ShieldAlert, Send,
  Menu, Megaphone, NotebookPen, Globe, Sparkles, MessageSquare, Home,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dev Dashboard" },
      { name: "description", content: "Lightweight single-screen developer dashboard." },
    ],
  }),
});

type Post = { id: number; author: string; verified: boolean; text: string };
type Section = "home" | "broadcast" | "notebooks" | "feed" | "ai" | "feedback";

const initialPosts: Post[] = [
  { id: 1, author: "Ada Lovelace", verified: true, text: "Shipped a new diff renderer today — feels fast and crisp." },
  { id: 2, author: "Linus T.", verified: true, text: "Small commits, clear messages, never break the main branch." },
];

const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "broadcast", label: "Lead Dev Broadcast", icon: Megaphone },
  { id: "notebooks", label: "My Private Notebooks", icon: NotebookPen },
  { id: "feed", label: "Global Feed", icon: Globe },
  { id: "ai", label: "AI Checker", icon: Sparkles },
  { id: "feedback", label: "Developer Feedback Hub", icon: MessageSquare },
];

function Dashboard() {
  const [tapCount, setTapCount] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [section, setSection] = useState<Section>("home");
  const [navOpen, setNavOpen] = useState(false);

  const handleTitleTap = () => {
    const next = tapCount + 1;
    if (next >= 5) { setAdminMode(true); setTapCount(0); }
    else setTapCount(next);
  };

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const charCount = draft.length;
  const formattingOk = draft.trim().length > 0 && !/\s{3,}/.test(draft) && charCount <= 500;

  const submitPost = () => {
    const text = draft.trim();
    if (!text || text.length > 500) return;
    setPosts((p) => [{ id: Date.now(), author: "You", verified: false, text }, ...p]);
    setDraft("");
  };

  const go = (s: Section) => { setSection(s); setNavOpen(false); };
  const currentLabel = NAV.find((n) => n.id === section)?.label ?? "Home";

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        {/* Top bar with hamburger */}
        <div className="flex items-center gap-2">
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9">
                <div className="flex flex-col gap-[5px]">
                  <span className="block h-[2px] w-5 bg-foreground" />
                  <span className="block h-[2px] w-5 bg-foreground" />
                  <span className="block h-[2px] w-5 bg-foreground" />
                </div>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle style={{ color: "#FFFFD7" }}>Dev Dashboard</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 space-y-1">
                {NAV.map((n) => {
                  const Icon = n.icon;
                  const active = section === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={() => go(n.id)}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{n.label}</span>
                    </button>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <h1
            onClick={handleTitleTap}
            style={{ color: "#FFFFD7" }}
            className="flex-1 text-center text-xl font-bold tracking-tight cursor-pointer select-none"
          >
            Dev Dashboard
          </h1>
          <div className="w-9" />
        </div>

        <p className="text-center text-[11px] text-muted-foreground -mt-2">
          {adminMode ? "Admin alert mode active" : `${currentLabel} · tap title 5× for admin`}
        </p>

        {adminMode && (
          <Card className="border-destructive bg-destructive/10 p-3 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Administrative Alert Mode</p>
              <p className="text-xs text-muted-foreground">Elevated controls unlocked.</p>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdminMode(false)}>
              Dismiss
            </Button>
          </Card>
        )}

        {/* Section views */}
        {section === "home" && (
          <section className="space-y-2">
            {NAV.filter((n) => n.id !== "home").map((n) => {
              const Icon = n.icon;
              return (
                <Card
                  key={n.id}
                  onClick={() => setSection(n.id)}
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{n.label}</span>
                </Card>
              );
            })}
          </section>
        )}

        {section === "broadcast" && (
          <Card className="border-2 border-destructive p-4">
            <Badge variant="destructive" className="uppercase tracking-wide mb-2">
              Lead Dev Broadcast
            </Badge>
            <p className="text-sm">
              v2.4 ships Friday. Freeze new feature merges until QA signs off. — Head Dev
            </p>
            <p className="text-[10px] text-muted-foreground mt-2">
              Restricted channel · head developer announcements only
            </p>
          </Card>
        )}

        {section === "notebooks" && (
          <div className="space-y-2">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Ideas</p>
              <p className="text-sm mt-1">Refactor auth into a single middleware.</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Todo</p>
              <p className="text-sm mt-1">Review PR #842, draft changelog.</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm mt-1">Postgres index on (user_id, created_at) helped a lot.</p>
            </Card>
          </div>
        )}

        {section === "feed" && (
          <>
            <Card className="p-3">
              <Label htmlFor="post" className="text-xs">Share something</Label>
              <Textarea
                id="post"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                placeholder="Write a post…"
                className="mt-1 min-h-20 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted-foreground">
                  {wordCount} words · {charCount}/500
                </span>
                <Button size="sm" onClick={submitPost} disabled={!draft.trim()}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Publish
                </Button>
              </div>
            </Card>
            <div className="space-y-2">
              {posts.map((p) => {
                const wc = p.text.trim().split(/\s+/).length;
                return (
                  <Card key={p.id} className="p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{p.author}</p>
                      {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="text-sm mt-1">{p.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{wc} words</p>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {section === "ai" && (
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Text formatting</span>
              <Badge variant={formattingOk ? "default" : "secondary"}>
                {draft.trim() ? (formattingOk ? "Looks good" : "Needs review") : "Idle"}
              </Badge>
            </div>
            <Separator className="my-2" />
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>· Length: {charCount}/500</li>
              <li>· No excessive whitespace: {/\s{3,}/.test(draft) ? "fail" : "ok"}</li>
              <li>· Non-empty: {draft.trim().length > 0 ? "ok" : "—"}</li>
            </ul>
            <p className="text-[10px] text-muted-foreground mt-2">
              Checks the Global Feed draft in real time.
            </p>
          </Card>
        )}

        {section === "feedback" && (
          <div className="space-y-2">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="h-4 w-4 text-destructive" />
                <p className="text-sm font-medium">Bug Reports</p>
              </div>
              <Input placeholder="Title" className="mb-2" />
              <Textarea placeholder="Steps to reproduce…" className="mb-2 min-h-16 resize-none" />
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" className="text-xs">
                  <Upload className="h-3.5 w-3.5 mr-1" /> Attach
                </Button>
                <Button size="sm">Submit</Button>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Feature Suggestions</p>
              </div>
              <Input placeholder="Idea title" className="mb-2" />
              <Textarea placeholder="Describe the feature…" className="mb-2 min-h-16 resize-none" />
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" className="text-xs">
                  <Upload className="h-3.5 w-3.5 mr-1" /> Attach mockup
                </Button>
                <Button size="sm">Submit</Button>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Video / Media Bug Reports</p>
              </div>
              <Input placeholder="What broke?" className="mb-2" />
              <Textarea placeholder="Context (timestamp, device, etc.)" className="mb-2 min-h-16 resize-none" />
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" className="text-xs">
                  <Upload className="h-3.5 w-3.5 mr-1" /> Attach video
                </Button>
                <Button size="sm">Submit</Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
