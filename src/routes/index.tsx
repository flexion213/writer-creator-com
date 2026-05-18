import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BadgeCheck, Bug, Lightbulb, Video, Upload, ShieldAlert, Send } from "lucide-react";

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

const initialPosts: Post[] = [
  {
    id: 1,
    author: "Ada Lovelace",
    verified: true,
    text: "Shipped a new diff renderer today — feels fast and crisp. Try it and share your traces.",
  },
  {
    id: 2,
    author: "Linus T.",
    verified: true,
    text: "Reminder: small commits, clear messages, and never break the main branch.",
  },
];

function Dashboard() {
  const [tapCount, setTapCount] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [draft, setDraft] = useState("");

  const handleTitleTap = () => {
    const next = tapCount + 1;
    if (next >= 5) {
      setAdminMode(true);
      setTapCount(0);
    } else {
      setTapCount(next);
    }
  };

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const charCount = draft.length;
  const formattingOk = draft.trim().length > 0 && !/\s{3,}/.test(draft) && charCount <= 500;

  const submitPost = () => {
    const text = draft.trim();
    if (!text || text.length > 500) return;
    setPosts((p) => [
      { id: Date.now(), author: "You", verified: false, text },
      ...p,
    ]);
    setDraft("");
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-6 space-y-5">
        {/* Header */}
        <header className="text-center select-none">
          <h1
            onClick={handleTitleTap}
            style={{ color: "#FFFFD7" }}
            className="text-2xl font-bold tracking-tight cursor-pointer"
          >
            Dev Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {adminMode ? "Admin alert mode active" : "Tap title 5× for admin alert"}
          </p>
        </header>

        {adminMode && (
          <Card className="border-destructive bg-destructive/10 p-3 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Administrative Alert Mode</p>
              <p className="text-xs text-muted-foreground">
                Elevated controls unlocked. Acting as admin.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setAdminMode(false)}
            >
              Dismiss
            </Button>
          </Card>
        )}

        {/* Lead Dev Broadcast */}
        <Card className="border-2 border-destructive p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="destructive" className="uppercase tracking-wide">
              Lead Dev Broadcast
            </Badge>
          </div>
          <p className="text-sm">
            v2.4 ships Friday. Freeze new feature merges until QA signs off. — Head Dev
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">
            Restricted channel · head developer announcements only
          </p>
        </Card>

        {/* Private Notebooks */}
        <section>
          <h2 className="text-sm font-semibold mb-2">My Private Notebooks</h2>
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
        </section>

        {/* Global Feed */}
        <section>
          <h2 className="text-sm font-semibold mb-2">Global Feed</h2>

          <Card className="p-3 mb-3">
            <Label htmlFor="post" className="text-xs">
              Share something
            </Label>
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
                    {p.verified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label="Verified" />
                    )}
                  </div>
                  <p className="text-sm mt-1">{p.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{wc} words</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* AI Checker */}
        <section>
          <h2 className="text-sm font-semibold mb-2">AI Checker</h2>
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
          </Card>
        </section>

        {/* Developer Feedback Hub */}
        <section>
          <h2 className="text-sm font-semibold mb-2">Developer Feedback Hub</h2>

          <Card className="p-3 mb-2">
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

          <Card className="p-3 mb-2">
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
        </section>

        <p className="text-center text-[10px] text-muted-foreground pt-2">
          Single scrollable view · lightweight build
        </p>
      </main>
    </div>
  );
}
