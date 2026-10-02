import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage, type Key } from "@/hooks/use-language";

const CAT_KEY: Record<string, Key> = {
  Announcement: "catAnnouncement",
  "Patch Notes": "catPatch",
  Update: "catUpdate",
  Maintenance: "catMaint",
  All: "all",
};
import {
  Megaphone,
  Plus,
  Crown,
  Shield,
  Pin,
  Trash2,
  Search,
  KeyRound,
} from "lucide-react";

const STORAGE_KEY = "wc:community_announcements";
const ADMIN_KEY = "LETMEIN";

export const ANNOUNCEMENT_CATEGORIES = [
  "Announcement",
  "Patch Notes",
  "Update",
  "Maintenance",
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export type AnnouncementRole = "Admin" | "Mod";

export type Announcement = {
  id: string;
  title: string;
  category: AnnouncementCategory;
  body: string;
  author: string;
  role: AnnouncementRole;
  pinned: boolean;
  ts: number;
};

const SEED: Announcement[] = [
  {
    id: "seed-1",
    title: "Version 2.4 is live",
    category: "Patch Notes",
    body:
      "## What's new\n- Version history for every notebook draft\n- Tactical maps now sync to your account\n- Faster drawing canvas on phones\n\n## Fixes\n- Character cards no longer duplicate after a refresh\n- Language choice sticks between visits",
    author: "Head Dev",
    role: "Admin",
    pinned: true,
    ts: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: "seed-2",
    title: "Community guidelines reminder",
    category: "Announcement",
    body:
      "Keep feedback kind and spoiler-free. Tag chapters with content warnings where needed.\n\nReports are reviewed by the moderation team within 48 hours.",
    author: "Moderation Team",
    role: "Mod",
    pinned: false,
    ts: Date.now() - 1000 * 60 * 60 * 52,
  },
];

function loadAnnouncements(): Announcement[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as Announcement[];
    if (!Array.isArray(parsed)) return SEED;
    const seen = new Set<string>();
    return parsed.filter((p) => {
      if (!p || typeof p.id !== "string" || typeof p.title !== "string") return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  } catch {
    return SEED;
  }
}

function formatStamp(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  const rel =
    mins < 1 ? "just now"
    : mins < 60 ? `${mins}m ago`
    : mins < 60 * 24 ? `${Math.round(mins / 60)}h ago`
    : `${Math.round(mins / 1440)}d ago`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(
    undefined,
    { hour: "numeric", minute: "2-digit" },
  )} · ${rel}`;
}

/** Lightweight markdown rendering: headings, bullets, bold, blank-line paragraphs. */
function RichBody({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const out: React.ReactNode[] = [];
    let list: string[] = [];
    const flush = (key: string) => {
      if (list.length === 0) return;
      out.push(
        <ul key={`ul-${key}`} className="my-2 list-disc space-y-1 pl-5 text-sm text-foreground/80">
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
      list = [];
    };
    lines.forEach((raw, i) => {
      const line = raw.trimEnd();
      if (/^\s*[-*]\s+/.test(line)) {
        list.push(line.replace(/^\s*[-*]\s+/, ""));
        return;
      }
      flush(String(i));
      if (/^###\s+/.test(line)) {
        out.push(<h4 key={i} className="mt-3 text-sm font-semibold">{inline(line.slice(4))}</h4>);
      } else if (/^##\s+/.test(line)) {
        out.push(<h3 key={i} className="mt-3 text-base font-semibold">{inline(line.slice(3))}</h3>);
      } else if (/^#\s+/.test(line)) {
        out.push(<h2 key={i} className="mt-3 text-lg font-semibold">{inline(line.slice(2))}</h2>);
      } else if (line.trim() === "") {
        out.push(<div key={i} className="h-2" />);
      } else {
        out.push(
          <p key={i} className="text-sm leading-relaxed text-foreground/80">{inline(line)}</p>,
        );
      }
    });
    flush("end");
    return out;
  }, [text]);
  return <div className="space-y-0.5">{blocks}</div>;
}

function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.8em]">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function RoleBadge({ role }: { role: AnnouncementRole }) {
  const { t } = useLanguage();
  const Icon = role === "Admin" ? Crown : Shield;
  return (
    <Badge
      variant="secondary"
      className={
        role === "Admin"
          ? "gap-1 border-amber-400/30 bg-amber-400/15 text-amber-200"
          : "gap-1 border-sky-400/30 bg-sky-400/15 text-sky-200"
      }
    >
      <Icon className="h-3 w-3" />
      {t(role === "Admin" ? "roleAdmin" : "roleMod")}
    </Badge>
  );
}

export default function CommunityAnnouncements() {
  const { isAdmin, isModerator, profile, user } = useAuth();
  const { t } = useLanguage();
  const staffName =
    profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Staff";

  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<"All" | AnnouncementCategory>("All");
  const [query, setQuery] = useState("");

  const [adminMode, setAdminMode] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyUnlocked, setKeyUnlocked] = useState(false);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("Announcement");
  const [body, setBody] = useState("");
  const [role, setRole] = useState<AnnouncementRole>("Admin");
  const [pinned, setPinned] = useState(false);
  const publishing = useRef(false);

  // Hydrate after mount (avoids SSR mismatch).
  useEffect(() => {
    setItems(loadAnnouncements());
    try {
      setKeyUnlocked(window.localStorage.getItem("wc:announce_key_ok") === "1");
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const canPost = (isAdmin || isModerator || keyUnlocked) && adminMode;
  const canToggle = isAdmin || isModerator || keyUnlocked;

  useEffect(() => {
    if (isAdmin) setRole("Admin");
    else if (isModerator) setRole("Mod");
  }, [isAdmin, isModerator]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((a) => (filter === "All" ? true : a.category === filter))
      .filter((a) =>
        q === "" ? true : (a.title + " " + a.body + " " + a.author).toLowerCase().includes(q),
      )
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.ts - a.ts);
  }, [items, filter, query]);

  const unlock = () => {
    if (keyInput.trim().toUpperCase() !== ADMIN_KEY) {
      toast.error(t("badCode"));
      return;
    }
    setKeyUnlocked(true);
    setAdminMode(true);
    setKeyInput("");
    try {
      window.localStorage.setItem("wc:announce_key_ok", "1");
    } catch {}
    toast.success(t("unlocked"));
  };

  const resetComposer = () => {
    setTitle("");
    setBody("");
    setCategory("Announcement");
    setPinned(false);
  };

  const publish = () => {
    if (publishing.current) return;
    const t = title.trim();
    const b = body.trim();
    if (!t) { toast.error(t("needTitle")); return; }
    if (!b) { toast.error(t("needContent")); return; }
    publishing.current = true;
    const entry: Announcement = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: t,
      category,
      body: b,
      author: staffName,
      role,
      pinned,
      ts: Date.now(),
    };
    setItems((prev) => [entry, ...prev]);
    resetComposer();
    setOpen(false);
    toast.success(t("annPublished"));
    window.setTimeout(() => { publishing.current = false; }, 400);
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((a) => a.id !== id));
    toast.success(t("annRemoved"));
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 pb-28 pt-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{t("annTitle")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("annSub")}
            </p>
          </div>
        </div>

        {canToggle ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Label htmlFor="admin-mode" className="text-xs">{t("adminMode")}</Label>
            <Switch id="admin-mode" checked={adminMode} onCheckedChange={setAdminMode} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") unlock(); }}
              placeholder={t("staffCode")}
              className="h-9 w-32"
              aria-label={t("staffCode")}
            />
            <Button variant="outline" size="sm" className="h-9 gap-1" onClick={unlock}>
              <KeyRound className="h-3.5 w-3.5" />
              {t("unlock")}
            </Button>
          </div>
        )}
      </div>

      {/* Filters + search */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["All", ...ANNOUNCEMENT_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`h-8 rounded-full border px-3 text-xs transition ${
              filter === c
                ? "border-transparent bg-foreground text-background"
                : "border-white/10 bg-white/5 text-foreground/70 hover:bg-white/10"
            }`}
          >
            {t(CAT_KEY[c])}
          </button>
        ))}
        <div className="relative ml-auto min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchAnn")}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {/* Feed */}
      {!hydrated ? null : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-muted-foreground">
          {t("noAnn")}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((a) => (
            <article
              key={a.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {a.pinned && (
                  <Badge variant="secondary" className="gap-1 border-white/15 bg-white/10">
                    <Pin className="h-3 w-3" /> {t("pinned")}
                  </Badge>
                )}
                <Badge variant="outline" className="border-white/15 text-[11px]">
                  {t(CAT_KEY[a.category])}
                </Badge>
                <RoleBadge role={a.role} />
                {canPost && (
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    aria-label="Delete announcement"
                    className="ml-auto rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <h2 className="text-base font-semibold leading-snug">{a.title}</h2>
              <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
                {a.author} · {formatStamp(a.ts)}
              </p>
              <RichBody text={a.body} />
            </article>
          ))}
        </div>
      )}

      {/* Floating new-post button (staff only, admin mode on) */}
      {canPost && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-12 gap-2 rounded-full px-5 shadow-lg"
        >
          <Plus className="h-4 w-4" />
          {t("newPost")}
        </Button>
      )}

      {/* Composer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("newAnn")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-title" className="text-xs">{t("titleLbl")}</Label>
              <Input
                id="a-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Version 2.5 release notes"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("category")}</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as AnnouncementCategory)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANNOUNCEMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{t(CAT_KEY[c])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("postingAs")}</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AnnouncementRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">{t("roleAdmin")}</SelectItem>
                    <SelectItem value="Mod">{t("roleMod")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-body" className="text-xs">{t("content")}</Label>
              <Textarea
                id="a-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"## What's new\n- First change\n- Second change"}
                className="min-h-[160px] font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("mdHint")}
              </p>
            </div>
            {body.trim() !== "" && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("preview")}
                </p>
                <RichBody text={body} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch id="a-pin" checked={pinned} onCheckedChange={setPinned} />
              <Label htmlFor="a-pin" className="text-xs">{t("pinTop")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={publish}>{t("publish")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
