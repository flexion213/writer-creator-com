import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Lock } from "lucide-react";

/**
 * Absolute-ban lockout screen. When mounted it clears the user's session
 * and shows an un-bypassable message. There are no navigation options.
 */
export function SystemLockScreen() {
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
        try { window.localStorage.clear(); } catch {}
        try { window.sessionStorage.clear(); } catch {}
      } finally {
        setSignedOut(true);
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050506] text-white px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
        <Lock className="h-7 w-7 text-rose-400" />
      </div>
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight max-w-md">
        Your account has been permanently suspended for violating community guidelines.
      </h1>
      <p className="mt-4 text-xs text-white/40">
        {signedOut ? "Session terminated." : "Terminating session…"}
      </p>
    </div>
  );
}

/**
 * Guard that watches the current profile and, the moment `is_system_locked`
 * becomes true, replaces the entire UI with SystemLockScreen.
 */
export function SystemLockGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (profile?.is_system_locked) return <SystemLockScreen />;
  return <>{children}</>;
}
