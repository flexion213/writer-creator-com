import { useAuth } from "@/hooks/use-auth";
import { LANGUAGES, useLanguage, type LangCode } from "@/hooks/use-language";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LogIn, LogOut, Languages, Palette, UserRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function SettingsPanel() {
  const { user, profile, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      try { window.localStorage.removeItem("dd:section"); } catch {}
      toast.success(t("signOut"));
      navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  };

  const who = profile?.username || profile?.display_name || user?.email || null;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3 rounded-2xl border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/40">
            <UserRound className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight">{t("account")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {who ? `${t("signedInAs")} ${who}` : t("guest")}
        </p>
        {user ? (
          <Button variant="destructive" className="w-full rounded-xl" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> {t("signOut")}
          </Button>
        ) : (
          <Button className="w-full rounded-xl" onClick={() => navigate({ to: "/auth" })}>
            <LogIn className="h-4 w-4 mr-2" /> {t("signIn")}
          </Button>
        )}
      </Card>

      <Card className="p-4 space-y-3 rounded-2xl border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/40">
            <Languages className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight">{t("language")}</h3>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-language" className="text-xs text-muted-foreground">
            {t("languageHint")}
          </Label>
          <Select value={lang} onValueChange={(v) => setLang(v as LangCode)}>
            <SelectTrigger id="app-language" className="rounded-xl" aria-label={t("language")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label} · {l.native}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-4 space-y-2 rounded-2xl border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/40">
            <Palette className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight">{t("appearance")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t("darkOnly")}</p>
      </Card>
    </div>
  );
}
