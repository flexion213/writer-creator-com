import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedPatcher } from "@/hooks/use-debounced-patcher";
import { useLanguage, type Key } from "@/hooks/use-language";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookMarked, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export type WikiEntry = {
  id: string;
  user_id: string;
  category: string;
  title: string;
  summary: string;
  details: string;
  updated_at: string;
};

export const WIKI_CATEGORIES: { id: string; key: Key }[] = [
  { id: "characters", key: "catCharacters" },
  { id: "factions", key: "catFactions" },
  { id: "locations", key: "catLocations" },
  { id: "gear", key: "catGear" },
];

export function useWikiEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user) { setEntries([]); setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("wiki_entries")
        .select("*")
        .order("created_at", { ascending: true });
      if (!alive) return;
      setEntries([...new Map(((data as WikiEntry[]) ?? []).map((e) => [e.id, e])).values()]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Coalesce keystrokes into one write per entry so edits never race or reset.
  const patcher = useDebouncedPatcher<WikiEntry>(
    async (id, patch) => { await supabase.from("wiki_entries").update(patch).eq("id", id); },
  );
  const adding = useRef(false);

  const add = useCallback(async (category: string) => {
    if (!user || adding.current) return;
    // Validation: never stack a second blank card on top of an unfinished one.
    if (entries.some((e) => !e.title.trim() && !e.summary.trim() && !e.details.trim())) {
      return "blank" as const;
    }
    adding.current = true;
    try {
      const { data } = await supabase
        .from("wiki_entries")
        .insert({ user_id: user.id, category, title: "", summary: "", details: "" })
        .select()
        .single();
      if (data) setEntries((xs) => (xs.some((x) => x.id === data.id) ? xs : [...xs, data as WikiEntry]));
    } finally {
      adding.current = false;
    }
  }, [user?.id, entries]);

  const update = useCallback((id: string, patch: Partial<WikiEntry>) => {
    setEntries((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    patcher.queue(id, patch);
  }, [patcher]);

  const remove = useCallback(async (id: string) => {
    patcher.drop(id);
    setEntries((xs) => xs.filter((x) => x.id !== id));
    await supabase.from("wiki_entries").delete().eq("id", id);
  }, [patcher]);

  return { entries, loading, add, update, remove, signedIn: !!user };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Renders text with every saved wiki entry title highlighted. Tapping a
 * highlighted term opens a small preview card inline — no navigation.
 */
export function LoreHighlightedText({
  text,
  entries,
  className,
}: {
  text: string;
  entries: WikiEntry[];
  className?: string;
}) {
  const { t } = useLanguage();
  const [active, setActive] = useState<WikiEntry | null>(null);

  const titled = useMemo(
    () => entries.filter((e) => e.title.trim().length >= 2),
    [entries],
  );

  const pattern = useMemo(() => {
    if (titled.length === 0) return null;
    const sorted = [...titled].sort((a, b) => b.title.length - a.title.length);
    return new RegExp(`(${sorted.map((e) => escapeRegExp(e.title.trim())).join("|")})`, "gi");
  }, [titled]);

  const parts = useMemo(() => {
    if (!pattern || !text) return [{ text, entry: null as WikiEntry | null }];
    const out: { text: string; entry: WikiEntry | null }[] = [];
    let last = 0;
    for (const m of text.matchAll(pattern)) {
      const i = m.index ?? 0;
      if (i > last) out.push({ text: text.slice(last, i), entry: null });
      const found = titled.find((e) => e.title.trim().toLowerCase() === m[0].toLowerCase()) ?? null;
      out.push({ text: m[0], entry: found });
      last = i + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), entry: null });
    return out;
  }, [pattern, text, titled]);

  const matchCount = parts.filter((p) => p.entry).length;

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="whitespace-pre-wrap text-base leading-relaxed">
        {parts.map((p, i) =>
          p.entry ? (
            <button
              key={i}
              type="button"
              onClick={() => setActive(p.entry)}
              onMouseEnter={() => setActive(p.entry)}
              className="text-primary underline decoration-primary/50 decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              {p.text}
            </button>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {matchCount > 0 ? t("loreLinkHint") : t("noMatches")}
      </p>

      {active && (
        <div className="sticky bottom-2 mt-3 z-20">
          <Card className="p-3 rounded-2xl border-primary/30 bg-background/95 backdrop-blur shadow-premium space-y-1.5">
            <div className="flex items-start gap-2">
              <BookMarked className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold tracking-tight truncate">{active.title}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {t((WIKI_CATEGORIES.find((c) => c.id === active.category)?.key) ?? "catCharacters")}
                </Badge>
              </div>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 rounded-xl"
                aria-label={t("close")} onClick={() => setActive(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {active.summary.trim() && (
              <p className="text-xs text-muted-foreground">{active.summary}</p>
            )}
            {active.details.trim() && (
              <p className="text-xs leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                {active.details}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export function WorldWiki() {
  const { t } = useLanguage();
  const { entries, add, update, remove, signedIn } = useWikiEntries();
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const visible = entries.filter((e) => {
    if (filter !== "all" && e.category !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.details.toLowerCase().includes(q)
    );
  });

  if (!signedIn) {
    return (
      <Card className="p-6 rounded-2xl text-center text-sm text-muted-foreground">
        {t("signInRequired")}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4 rounded-2xl border-white/10 bg-white/[0.03] space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/40">
            <BookMarked className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{t("wiki")}</h3>
            <p className="text-[11px] text-muted-foreground">{t("wikiSubtitle")}</p>
          </div>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchWiki")}
          aria-label={t("searchWiki")}
          className="h-9 rounded-xl text-sm"
        />

        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {[{ id: "all", key: "allCategories" as Key }, ...WIKI_CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`shrink-0 px-3 h-8 rounded-full text-xs transition ${
                filter === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {t(c.key)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {WIKI_CATEGORIES.map((c) => (
            <Button
              key={c.id} size="sm" variant="outline" className="rounded-full"
              onClick={async () => { if ((await add(c.id)) === "blank") toast.error(t("blankCardWarning")); }}
            >
              <Plus className="h-3 w-3 mr-1" /> {t(c.key)}
            </Button>
          ))}
        </div>
      </Card>

      {visible.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">{t("noWikiEntries")}</p>
      )}

      <div className="space-y-2">
        {visible.map((e) => (
          <Card key={e.id} className="p-3 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={e.category}
                onChange={(ev) => update(e.id, { category: ev.target.value })}
                aria-label={t("category")}
                className="h-7 rounded-xl border bg-background text-xs px-2"
              >
                {WIKI_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{t(c.key)}</option>
                ))}
              </select>
              <Input
                value={e.title}
                onChange={(ev) => update(e.id, { title: ev.target.value })}
                placeholder={t("entryTitlePh")}
                className="h-7 rounded-xl text-sm font-medium flex-1"
              />
              <Button
                size="icon" variant="ghost" aria-label={t("deleteEntry")}
                className="h-7 w-7 hover:text-destructive" onClick={() => remove(e.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              value={e.summary}
              onChange={(ev) => update(e.id, { summary: ev.target.value })}
              placeholder={t("entrySummaryPh")}
              className="h-7 rounded-xl text-xs"
            />
            <Textarea
              value={e.details}
              onChange={(ev) => update(e.id, { details: ev.target.value })}
              placeholder={t("entryDetailsPh")}
              className="min-h-[70px] rounded-xl text-xs"
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
