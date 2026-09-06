import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/use-language";
import { countWords, type Snapshot } from "@/hooks/use-version-history";

export function VersionHistoryDrawer({
  open,
  onOpenChange,
  snapshots,
  currentTitle,
  currentBody,
  onRestore,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshots: Snapshot[];
  currentTitle: string;
  currentBody: string;
  onRestore: (snap: Snapshot) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedId((id) => id ?? snapshots[0]?.id ?? null);
  }, [open, snapshots]);

  const selected = snapshots.find((s) => s.id === selectedId) ?? null;

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> {t("versionHistory")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_1fr]">
          {/* Timeline */}
          <div className="border-b md:border-b-0 md:border-r overflow-y-auto max-h-56 md:max-h-none p-2 space-y-1">
            {snapshots.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">{t("noVersions")}</p>
            )}
            {snapshots.map((s) => (
              <button
                key={s.id}
                onClick={() => { setSelectedId(s.id); setConfirmId(null); }}
                className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${
                  s.id === selectedId ? "bg-primary/10 border border-primary/40" : "hover:bg-muted/60 border border-transparent"
                }`}
              >
                <span className="block text-xs font-medium">{t("draft")} — {fmt(s.ts)}</span>
                <span className="block text-[10px] text-muted-foreground tabular-nums">
                  {s.words.toLocaleString()} {t("words")}
                </span>
              </button>
            ))}
          </div>

          {/* Side-by-side comparison */}
          <div className="min-h-0 grid grid-rows-[auto_1fr] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              {selected ? (
                <>
                  <Badge variant="secondary" className="rounded-xl text-[10px]">{fmt(selected.ts)}</Badge>
                  {confirmId === selected.id ? (
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">{t("confirmRestore")}</span>
                      <Button
                        size="sm"
                        className="h-7 rounded-xl text-[11px]"
                        onClick={() => {
                          onRestore(selected);
                          setConfirmId(null);
                          onOpenChange(false);
                          toast.success(t("versionRestored"));
                        }}
                      >
                        {t("confirm")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 rounded-xl text-[11px]" onClick={() => setConfirmId(null)}>
                        {t("cancel")}
                      </Button>
                    </div>
                  ) : (
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 rounded-xl text-[11px] gap-1" onClick={() => setConfirmId(selected.id)}>
                        <RotateCcw className="h-3.5 w-3.5" /> {t("restoreVersion")}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-xl"
                        aria-label={t("delete")}
                        onClick={() => { onDelete(selected.id); setSelectedId(null); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">{t("selectVersion")}</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 min-h-0 overflow-hidden">
              <div className="min-h-0 flex flex-col border-r">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  {t("selectedVersion")} {selected ? `· ${selected.words} ${t("words")}` : ""}
                </div>
                <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed font-sans">
                  {selected ? `${selected.title}\n\n${selected.body}` : ""}
                </pre>
              </div>
              <div className="min-h-0 flex flex-col">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  {t("currentDraft")} · {countWords(currentBody)} {t("words")}
                </div>
                <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed font-sans">
                  {`${currentTitle}\n\n${currentBody}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
