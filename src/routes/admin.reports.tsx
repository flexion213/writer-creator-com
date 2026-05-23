import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, Bug, Lightbulb, Video, ShieldAlert, Loader2, Check, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — Admin" }] }),
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

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Toaster />
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/admin" className="inline-flex items-center text-xs text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Admin
          </Link>
          <h1 className="flex-1 text-center text-xl font-bold tracking-tight" style={{ color: "#FFFFD7" }}>
            Reports
          </h1>
          <div className="w-10" />
        </div>

        <div className="flex gap-1 overflow-x-auto">
          {(["all","bug","feature","video","user"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? "default" : "outline"}
              className="text-xs capitalize"
              onClick={() => setFilter(k)}
            >
              {k}
            </Button>
          ))}
        </div>

        {fetching && <Card className="p-6 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></Card>}
        {!fetching && visible.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">No reports.</p>
        )}

        <div className="space-y-2">
          {visible.map((r) => {
            const meta = KIND_META[r.kind];
            const Icon = meta.icon;
            return (
              <Card key={r.id} className={`p-3 ${r.resolved ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${meta.color}`} />
                  <Badge variant="outline" className="text-[9px] uppercase">{meta.label}</Badge>
                  {r.resolved && <Badge className="text-[9px]">Resolved</Badge>}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{r.title}</p>
                {r.body && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{r.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-2">
                  From @{profiles[r.reporter_id] ?? r.reporter_id.slice(0, 8)}
                  {r.reported_user_id && <> · about @{profiles[r.reported_user_id] ?? r.reported_user_id.slice(0, 8)}</>}
                </p>
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => toggleResolved(r)}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {r.resolved ? "Reopen" : "Mark resolved"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}