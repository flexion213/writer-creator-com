import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Crown, Shield, ArrowLeft, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
  head: () => ({ meta: [{ title: "Admin Dashboard" }] }),
});

type AppRole = "admin" | "moderator" | "user";
type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  roles: AppRole[];
};

function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!isAdmin) { navigate({ to: "/" }); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, isAdmin]);

  const load = async () => {
    setFetching(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name").order("username"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser: Record<string, AppRole[]> = {};
    for (const r of (roles as Array<{ user_id: string; role: AppRole }> | null) ?? []) {
      (byUser[r.user_id] ??= []).push(r.role);
    }
    setUsers(
      ((profiles as Array<{ id: string; username: string; display_name: string | null }> | null) ?? []).map((p) => ({
        ...p,
        roles: byUser[p.id] ?? [],
      })),
    );
    setFetching(false);
  };

  const setRole = async (uid: string, role: AppRole, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${on ? "Granted" : "Revoked"} ${role}`);
    void load();
  };

  const filtered = q
    ? users.filter((u) => u.username.toLowerCase().includes(q.toLowerCase()) || (u.display_name ?? "").toLowerCase().includes(q.toLowerCase()))
    : users;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Toaster />
      <main className="mx-auto max-w-md px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="inline-flex items-center text-xs text-muted-foreground">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
          </Link>
          <h1 className="flex-1 text-center text-xl font-bold tracking-tight flex items-center justify-center gap-2" style={{ color: "#FFFFD7" }}>
            <Crown className="h-5 w-5" /> Admin Dashboard
          </h1>
          <div className="w-10" />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="pl-9" />
        </div>

        {fetching && (
          <Card className="p-6 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></Card>
        )}

        {!fetching && filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">No users found.</p>
        )}

        <div className="space-y-2">
          {filtered.map((u) => {
            const isAdminRole = u.roles.includes("admin");
            const isModRole = u.roles.includes("moderator");
            const isSelf = u.id === user?.id;
            return (
              <Card key={u.id} className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      @{u.username}
                      {isAdminRole && (
                        <Badge className="text-[9px] h-4 px-1.5" style={{ background: "linear-gradient(135deg,#FFE680,#C9A227)", color: "#000" }}>
                          <Crown className="h-2.5 w-2.5 mr-0.5" /> Admin
                        </Badge>
                      )}
                      {isModRole && (
                        <Badge
                          className="text-[9px] h-4 px-1.5 text-white"
                          style={{ background: "linear-gradient(135deg,#ff1a1a,#8a0000)" }}
                        >
                          <Shield className="h-2.5 w-2.5 mr-0.5" /> Mod
                        </Badge>
                      )}
                    </p>
                    {u.display_name && (
                      <p className="text-[10px] text-muted-foreground truncate">{u.display_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  <Button
                    size="sm"
                    variant={isModRole ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setRole(u.id, "moderator", !isModRole)}
                  >
                    {isModRole ? "Remove Mod" : "Make Mod"}
                  </Button>
                  <Button
                    size="sm"
                    variant={isAdminRole ? "default" : "outline"}
                    className="flex-1 text-xs"
                    disabled={isSelf && isAdminRole}
                    onClick={() => setRole(u.id, "admin", !isAdminRole)}
                    title={isSelf && isAdminRole ? "You can't demote yourself" : ""}
                  >
                    {isAdminRole ? "Remove Admin" : "Make Admin"}
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