import { useRef, useState, useEffect } from "react";
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
  NotebookPen, Globe, MessageSquare, Pencil, ImagePlus, X, Eraser, Megaphone,
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

type Post = { id: number; author: string; verified: boolean; text: string; image?: string };
type Section = "feed" | "notebooks" | "suggestions" | "drawing";

const initialPosts: Post[] = [
  { id: 1, author: "Ada Lovelace", verified: true, text: "Shipped a new diff renderer today — feels fast and crisp." },
  { id: 2, author: "Linus T.", verified: true, text: "Small commits, clear messages, never break the main branch." },
];

const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "feed", label: "Global Feed", icon: Globe },
  { id: "notebooks", label: "My Private Notebooks", icon: NotebookPen },
  { id: "suggestions", label: "Suggestions Box", icon: MessageSquare },
  { id: "drawing", label: "Drawing Studio", icon: Pencil },
];

function Dashboard() {
  const [tapCount, setTapCount] = useState(0);
  const [adminMode, setAdminMode] = useState(false);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [draftImage, setDraftImage] = useState<string | undefined>(undefined);
  const [section, setSection] = useState<Section>("feed");
  const [navOpen, setNavOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTitleTap = () => {
    const next = tapCount + 1;
    if (next >= 5) { setAdminMode(true); setTapCount(0); }
    else setTapCount(next);
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
    if ((!text && !draftImage) || text.length > 500) return;
    setPosts((p) => [{ id: Date.now(), author: "You", verified: false, text, image: draftImage }, ...p]);
    setDraft("");
    setDraftImage(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const go = (s: Section) => { setSection(s); setNavOpen(false); };
  const currentLabel = NAV.find((n) => n.id === section)?.label ?? "Global Feed";

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
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

        {section === "feed" && (
          <>
            <Card className="border-2 border-destructive p-3">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="h-4 w-4 text-destructive" />
                <Badge variant="destructive" className="uppercase tracking-wide text-[10px]">
                  Lead Dev Broadcast
                </Badge>
              </div>
              <p className="text-sm">v2.4 ships Friday. Freeze new feature merges until QA signs off. — Head Dev</p>
            </Card>

            <Card className="p-3">
              <Label htmlFor="post" className="text-xs">Share something</Label>
              <Textarea
                id="post"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 500))}
                placeholder="Write a post…"
                className="mt-1 min-h-20 resize-none"
              />
              {draftImage && (
                <div className="relative mt-2">
                  <img src={draftImage} alt="attachment preview" className="rounded-md max-h-48 w-full object-cover" />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => { setDraftImage(undefined); if (fileRef.current) fileRef.current.value = ""; }}
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
              />
              <div className="flex items-center justify-between mt-2 gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {wordCount} w · {charCount}/500
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="h-3.5 w-3.5 mr-1" /> Photo
                  </Button>
                  <Button size="sm" onClick={submitPost} disabled={!draft.trim() && !draftImage}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Post
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              {posts.map((p) => {
                const wc = p.text.trim() ? p.text.trim().split(/\s+/).length : 0;
                return (
                  <Card key={p.id} className="p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{p.author}</p>
                      {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    {p.text && <p className="text-sm mt-1">{p.text}</p>}
                    {p.image && (
                      <img src={p.image} alt="post" className="mt-2 rounded-md max-h-64 w-full object-cover" />
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">{wc} words</p>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {section === "notebooks" && <Notebooks />}
        {section === "suggestions" && <Suggestions />}
        {section === "drawing" && <DrawingStudio />}
      </main>
    </div>
  );
}

function Notebooks() {
  return (
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
  );
}

function Suggestions() {
  return (
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
  );
}

function DrawingStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#FFFFD7");
  const [size, setSize] = useState(4);
  const drawing = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, c.width, c.height);
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer bg-transparent" />
          <input type="range" min={1} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-24" />
          <span className="text-[11px] text-muted-foreground">{size}px</span>
        </div>
        <Button size="sm" variant="outline" onClick={clear}>
          <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full aspect-square rounded-md border touch-none"
      />
      <p className="text-[10px] text-muted-foreground">Drag to draw. Drawings are local to this session.</p>
    </Card>
  );
}
