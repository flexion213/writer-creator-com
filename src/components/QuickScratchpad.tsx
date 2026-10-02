import { useEffect, useRef, useState } from "react";
import { StickyNote, X, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "wc:scratchpad";

export default function QuickScratchpad() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      setText(window.localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, text);
      } catch {
        /* quota */
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [text, loaded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === "KeyN" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => areaRef.current?.focus(), 50);
    else setConfirmClear(false);
  }, [open]);

  const copyAll = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Scratchpad copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick scratchpad (Alt + N)"
        title="Quick scratchpad (Alt + N)"
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-premium flex items-center justify-center hover:scale-105 transition-transform"
      >
        <StickyNote className="h-5 w-5" />
      </button>

      <aside
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 h-dvh w-full sm:w-96 glass-panel shadow-premium flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        <header className="flex items-center gap-2 px-4 py-3 border-b">
          <StickyNote className="h-4 w-4 text-primary" />
          <h2 className="text-sm">Scratchpad</h2>
          <span className="text-[10px] text-muted-foreground">Alt + N</span>
          <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 rounded-xl" onClick={() => setOpen(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Plot notes, dialogue lines, ideas…"
          className="flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed outline-none custom-scroll"
        />

        <footer className="border-t px-4 py-3 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{words} words · saved</span>
          {confirmClear ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Clear note?</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 rounded-xl text-[11px]"
                onClick={() => {
                  setText("");
                  setConfirmClear(false);
                  toast.success("Scratchpad cleared");
                }}
              >
                Clear
              </Button>
              <Button size="sm" variant="ghost" className="h-7 rounded-xl text-[11px]" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 rounded-xl text-[11px] gap-1" disabled={!text.trim()} onClick={copyAll}>
                <Copy className="h-3.5 w-3.5" /> Copy all
              </Button>
              <Button size="sm" variant="ghost" className="h-7 rounded-xl text-[11px] gap-1" disabled={!text} onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          )}
        </footer>
      </aside>
    </>
  );
}
