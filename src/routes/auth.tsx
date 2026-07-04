import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in · Writer Creator" }] }),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreedToToS, setAgreedToToS] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!agreedToToS) {
          toast.error("You must agree to the Terms of Service to create an account.");
          return;
        }
        const u = username.trim();
        if (!/^[a-zA-Z0-9_]{3,32}$/.test(u)) {
          toast.error("Username must be 3–32 letters, numbers, or underscores.");
          return;
        }
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { username: u, display_name: u },
          },
        });
        if (error) { toast.error(error.message); return; }
        // Record ToS acceptance on the profile
        const uid = signUpData.user?.id;
        if (uid) {
          await supabase
            .from("profiles")
            .update({ agreed_to_tos: true, agreed_to_tos_at: new Date().toISOString() })
            .eq("id", uid);
        }
        toast.success("Account created!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Signed in");
        navigate({ to: "/" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Toaster />
      <Card className="w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <h1 style={{ color: "#FFFFD7" }} className="text-2xl font-bold">Writer Creator</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === "signin" ? "Sign in to your account" : "Create an account"}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_handle"
                autoComplete="username"
                required
              />
              <p className="text-[10px] text-muted-foreground">3–32 letters, numbers, underscores. People invite you with this.</p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>
          {mode === "signup" && (
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="tos"
                checked={agreedToToS}
                onCheckedChange={(v) => setAgreedToToS(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="tos" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                I agree to the{" "}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-2"
                  onClick={() => setTosOpen(true)}
                >
                  Terms of Service and Privacy Policy
                </button>
                .
              </label>
            </div>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={busy || (mode === "signup" && !agreedToToS)}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <div className="text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>No account yet?{" "}
              <button className="underline text-foreground" onClick={() => setMode("signup")}>Sign up</button>
            </>
          ) : (
            <>Already have one?{" "}
              <button className="underline text-foreground" onClick={() => setMode("signin")}>Sign in</button>
            </>
          )}
        </div>
        <Link to="/" className="block text-center text-[11px] text-muted-foreground underline">
          Continue without an account
        </Link>
      </Card>
      <Dialog open={tosOpen} onOpenChange={setTosOpen}>
        <DialogContent className="dark bg-background text-foreground max-w-lg max-h-[85vh] overflow-y-auto custom-scroll">
          <DialogHeader>
            <DialogTitle>Writer Creators – Terms of Service</DialogTitle>
            <DialogDescription className="text-xs">Last Updated: July 2026</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Welcome to Writer Creators. By creating an account, you agree to these fair and
              binding rules. These terms protect your creative work while keeping our community
              safe and clean.
            </p>

            <div>
              <h3 className="text-foreground font-semibold mb-1">1. Your Content, Your Rules (Intellectual Property)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><span className="text-foreground">100% Ownership:</span> You retain full ownership, copyright, and intellectual property rights over every story, character description, lore entry, and tactical map you create. Writer Creators claims zero ownership over your original work.</li>
                <li><span className="text-foreground">Privacy Guarantee:</span> Your private notebooks and tactical sandbox maps are strictly confidential. The system will never share, read, or distribute your private drafts without your explicit permission.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-foreground font-semibold mb-1">2. Community Guidelines (What is Forbidden)</h3>
              <p>To keep the platform safe for all writers, you agree not to publish public content that contains:</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li><span className="text-foreground">Harassment &amp; Hate:</span> Targeted bullying, personal attacks, or hate speech against other users.</li>
                <li><span className="text-foreground">Plagiarism:</span> Copying someone else's story word-for-word and claiming it as your own.</li>
                <li><span className="text-foreground">Spam &amp; Disruption:</span> Flooding the public feed with repetitive posts, advertisements, or malicious links/code designed to break the app.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-foreground font-semibold mb-1">3. Fair Moderation Enforcement (No Loopholes)</h3>
              <p>We believe in a fair warning system, but severe violations require immediate action. By agreeing to these terms, you acknowledge that our administration team handles platform protection through two distinct methods:</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li><span className="text-foreground">The Shadow Ban:</span> If an account is found consistently disrupting the community, spamming, or violating guidelines, the system may filter their public posts and comments so they are only visible to the author. This prevents platform disruption without deleting the user's private drafts.</li>
                <li><span className="text-foreground">The System Lock:</span> For extreme violations (such as hacking attempts, severe harassment, or malicious platform abuse), an account will be immediately and permanently suspended. The active session will be terminated, and access to the account will be fully revoked.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-foreground font-semibold mb-1">4. Account Security &amp; Responsibility</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>You are responsible for keeping your login credentials secure.</li>
                <li>If you discover any security bugs or platform exploits, you agree to report them to the site administration rather than exploiting them.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-foreground font-semibold mb-1">5. Termination of Service</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>You have the right to delete your account and remove all of your saved writing data at any given time.</li>
              </ul>
            </div>
          </div>
          <div className="pt-2">
            <Button
              type="button"
              className="w-full"
              onClick={() => { setAgreedToToS(true); setTosOpen(false); }}
            >
              I Understand &amp; Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}