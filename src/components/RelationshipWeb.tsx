import { useEffect, useMemo, useState } from "react";
import { Network, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Char = { id: string; name: string; role: string; traits: string; backstory: string };
type Link = { id: string; a: string; b: string; kind: string };

const KINDS = ["Ally", "Rival", "Enemy", "Sibling", "Parent", "Mentor", "Lover", "Friend", "Member of"];

export function RelationshipWeb({ notebookId, characters }: { notebookId: string; characters: Char[] }) {
  const key = `wc:rel:${notebookId}`;
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [kind, setKind] = useState(KINDS[0]);

  useEffect(() => {
    try { setLinks(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setLinks([]); }
  }, [key]);
  const save = (next: Link[]) => { setLinks(next); localStorage.setItem(key, JSON.stringify(next)); };

  const chars = characters.filter((c) => c.name.trim());
  const ids = new Set(chars.map((c) => c.id));
  const valid = links.filter((l) => ids.has(l.a) && ids.has(l.b));

  const pos = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    const n = chars.length;
    chars.forEach((c, i) => {
      const ang = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      const r = n === 1 ? 0 : 140;
      m[c.id] = { x: 200 + r * Math.cos(ang), y: 200 + r * Math.sin(ang) };
    });
    return m;
  }, [chars.map((c) => c.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = chars.find((c) => c.id === sel);

  if (!open)
    return (
      <Button size="sm" variant="outline" className="w-full rounded-2xl" onClick={() => setOpen(true)} disabled={chars.length < 2}>
        <Network className="h-3.5 w-3.5 mr-1" /> Relationship web
      </Button>
    );

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1"><Network className="h-4 w-4" /> Relationship web</span>
        <button aria-label="Close" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <svg viewBox="0 0 400 400" className="w-full max-w-md mx-auto aspect-square">
        {valid.map((l) => {
          const p = pos[l.a], q = pos[l.b];
          const hi = sel && (l.a === sel || l.b === sel);
          return (
            <g key={l.id} opacity={sel && !hi ? 0.2 : 1}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--primary)" strokeWidth={hi ? 2.5 : 1.5} />
              <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 4} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{l.kind}</text>
            </g>
          );
        })}
        {chars.map((c) => {
          const p = pos[c.id];
          const on = sel === c.id;
          return (
            <g key={c.id} onClick={() => setSel(on ? null : c.id)} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={22} fill={on ? "var(--primary)" : "var(--muted)"} stroke="var(--primary)" strokeWidth={1.5} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={on ? "var(--primary-foreground)" : "var(--foreground)"}>
                {c.name.trim().slice(0, 2).toUpperCase()}
              </text>
              <text x={p.x} y={p.y + 36} textAnchor="middle" fontSize="11" fill="var(--foreground)">{c.name.trim().slice(0, 16)}</text>
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="rounded-xl bg-muted/40 p-2 text-xs space-y-1">
          <div className="font-semibold text-sm">{selected.name}{selected.role && <span className="text-muted-foreground font-normal"> · {selected.role}</span>}</div>
          {selected.traits && <div>{selected.traits}</div>}
          {selected.backstory && <div className="text-muted-foreground line-clamp-4">{selected.backstory}</div>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1">
        {[{ v: a, s: setA }, null, { v: b, s: setB }].map((f, i) =>
          f ? (
            <select key={i} value={f.v} onChange={(e) => f.s(e.target.value)} className="h-8 rounded-lg bg-background border border-border text-xs px-1">
              <option value="">Character…</option>
              {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select key={i} value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 rounded-lg bg-background border border-border text-xs px-1">
              {KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          ),
        )}
      </div>
      <Button size="sm" className="w-full rounded-xl" disabled={!a || !b || a === b}
        onClick={() => { save([...links, { id: crypto.randomUUID(), a, b, kind }]); setA(""); setB(""); }}>
        Add connection
      </Button>

      {valid.length > 0 && (
        <ul className="space-y-1 text-xs">
          {valid.map((l) => (
            <li key={l.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2 py-1">
              <span>{chars.find((c) => c.id === l.a)?.name} — <b>{l.kind}</b> — {chars.find((c) => c.id === l.b)?.name}</span>
              <button aria-label="Remove" onClick={() => save(links.filter((x) => x.id !== l.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
