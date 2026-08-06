import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage, type Key } from "@/hooks/use-language";
import { BookMarked, BookOpen, Brush, Map, Sparkles, X } from "lucide-react";

const LS_KEY = "hasSeenTutorial";

type Step = {
  titleKey: Key;
  bodyKey: Key;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: Step[] = [
  { titleKey: "tutWelcomeTitle", bodyKey: "tutWelcomeBody", icon: Sparkles },
  { titleKey: "tutWriterTitle", bodyKey: "tutWriterBody", icon: BookOpen },
  { titleKey: "tutWikiTitle", bodyKey: "tutWikiBody", icon: BookMarked },
  { titleKey: "tutCanvasTitle", bodyKey: "tutCanvasBody", icon: Brush },
  { titleKey: "tutMapTitle", bodyKey: "tutMapBody", icon: Map },
];

export function OnboardingTutorial() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Only ever shows for users who have not completed or dismissed it before.
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) !== "true") setOpen(true);
    } catch {
      /* storage unavailable: stay silent rather than nagging */
    }
  }, []);

  const finish = () => {
    try { localStorage.setItem(LS_KEY, "true"); } catch {}
    setOpen(false);
  };

  if (!open) return null;
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("tutAria")}
        className="w-full max-w-md rounded-3xl glass-panel border border-border/60 shadow-premium p-6 relative"
      >
        <button
          onClick={finish}
          className="absolute right-4 top-4 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label={t("tutSkip")}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-6 w-6" />
        </div>

        <h2 className="mt-4 text-xl font-semibold tracking-tight">{t(current.titleKey)}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(current.bodyKey)}</p>

        <div className="mt-6 flex items-center gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.titleKey}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-2 bg-border"}`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="rounded-full" onClick={finish}>
            {t("tutSkip")}
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setStep((s) => s - 1)}>
                {t("tutBack")}
              </Button>
            )}
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            >
              {isLast ? t("tutStart") : t("tutNext")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
