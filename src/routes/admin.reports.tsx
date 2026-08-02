import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, Bug, Lightbulb, Video, ShieldAlert, Loader2, Check, Trash2, Activity, Crown, ShieldCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports · Writer Creator Admin" },
      { name: "description", content: "Staff-only queue of bug reports, suggestions and user reports for Writer Creator." },
      { property: "og:title", content: "Reports · Writer Creator Admin" },
      { property: "og:description", content: "Staff-only report and suggestion queue for Writer Creator." },
      { property: "og:url", content: "https://writer-creator-com.lovable.app/admin/reports" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Kind = "bug" | "feature" | "video" | "user";
type Report = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  reporter_id: string;
  reported_user_id: string | null;
  resolved: boolean;
  created_at: string;
};
type Profile = { id: string; username: string };

const KIND_META: Record<Kind, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  bug: { label: "Bug", icon: Bug, color: "text-destructive" },
  feature: { label: "Feature", icon: Lightbulb, color: "text-primary" },
  video: { label: "Video", icon: Video, color: "text-primary" },
  user: { label: "User report", icon: ShieldAlert, color: "text-destructive" },
};

function ReportsPage() {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<"all" | Kind>("all");

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!isAdmin && !isModerator) { navigate({ to: "/" }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, isAdmin, isModerator]);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("reports").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setFetching(false); return; }
    const rows = (data as Report[]) ?? [];
    setReports(rows);
    const ids = Array.from(new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id].filter(Boolean) as string[])));
    if (ids.length) {
      const { data: pr } = await supabase.from("profiles").select("id, username").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of (pr as Profile[] | null) ?? []) map[p.id] = p.username;
      setProfiles(map);
    }
    setFetching(false);
  };

  const toggleResolved = async (r: Report) => {
    const { error } = await supabase.from("reports").update({ resolved: !r.resolved }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    setReports((cur) => cur.map((x) => x.id === r.id ? { ...x, resolved: !r.resolved } : x));
  };
  const remove = async (r: Report) => {
    if (!confirm("Delete this report?")) return;
    const { error } = await supabase.from("reports").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    setReports((cur) => cur.filter((x) => x.id !== r.id));
  };

  const visible = filter === "all" ? reports : reports.filter((r) => r.kind === filter);

  const staff = [
    { name: "You", role: "Admin", icon: Crown, color: "text-amber-300", ago: "Just now" },
    { name: "Moderator · Nyx", role: "Moderator", icon: ShieldCheck, color: "text-rose-300", ago: "4h ago" },
    { name: "Moderator · Kai", role: "Moderator", icon: ShieldCheck, color: "text-rose-300", ago: "1d ago" },
    { name: "Admin · alkader", role: "Admin", icon: Crown, color: "text-amber-300", ago: "2d ago" },
  ];
  const unresolved = reports.filter((r) => !r.resolved).length;
  const resolvedCount = reports.length - unresolved;

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-[#0a0a0d] via-[#0b0b10] to-[#050506] text-foreground">
      <Toaster />
      <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Admin
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: "#FFFFD7" }}>
              Moderation Console
            </h1>
            <p className="text-xs text-muted-foreground">
              {unresolved} open · {resolvedCount} resolved · {reports.length} total
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          {/* COLUMN 1 — report queue */}
          <section className="space-y-4">
            <div className="flex gap-1 overflow-x-auto p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur w-fit">
              {(["all","bug","feature","video","user"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`text-xs capitalize px-3 h-8 rounded-xl transition ${
                    filter === k ? "bg-white text-black font-semibold" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {fetching && (
              <Card className="p-8 text-center bg-white/[0.03] border-white/10">
                <Loader2 className="h-5 w-5 mx-auto animate-spin" />
              </Card>
            )}
            {!fetching && visible.length === 0 && (
              <Card className="p-10 text-center bg-white/[0.03] border-white/10 border-dashed">
                <p className="text-sm text-muted-foreground">Queue is clear. Nothing to review.</p>
              </Card>
            )}

            <div className="space-y-3">
              {visible.map((r) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <Card
                    key={r.id}
                    className={`p-4 bg-white/[0.04] border-white/10 backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition ${
                      r.resolved ? "opacity-60" : "hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`h-8 w-8 rounded-xl bg-white/5 flex items-center justify-center ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <Badge variant="outline" className="text-[9px] uppercase border-white/20">{meta.label}</Badge>
                      {r.resolved && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-300 border-0">Resolved</Badge>}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-white">{r.title}</p>
                    {r.body && (
                      <p className="text-sm text-white/70 mt-1 whitespace-pre-wrap leading-relaxed">{r.body}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-3">
                      From <span className="text-white/70">@{profiles[r.reporter_id] ?? r.reporter_id.slice(0, 8)}</span>
                      {r.reported_user_id && (
                        <> · about <span className="text-rose-300">@{profiles[r.reported_user_id] ?? r.reported_user_id.slice(0, 8)}</span></>
                      )}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => toggleResolved(r)}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        {r.resolved ? "Reopen" : "Dismiss report"}
                      </Button>
                      <Button size="sm" variant="destructive" className="text-xs" onClick={() => remove(r)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete post
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* COLUMN 2 — staff activity */}
          <aside className="space-y-4">
            <Card className="p-4 bg-white/[0.04] border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-emerald-300" />
                <p className="text-sm font-semibold tracking-tight">Staff Activity</p>
              </div>
              <ul className="space-y-3">
                {staff.map((s) => {
                  const Icon = s.icon;
                  return (
                    <li key={s.name} className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center">
                        <Icon className={`h-4 w-4 ${s.color}`} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">{s.role}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-white/60">
                        <Clock className="h-3 w-3" /> {s.ago}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="p-4 bg-white/[0.04] border-white/10 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-widest text-white/50 mb-3">Queue snapshot</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-2xl font-bold text-white">{unresolved}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/50">Open</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-2xl font-bold text-emerald-300">{resolvedCount}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/50">Resolved</p>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}