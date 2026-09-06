import { useCallback, useEffect, useRef, useState } from "react";

export type Snapshot = {
  id: string;
  ts: number;
  words: number;
  title: string;
  body: string;
};

const MAX_SNAPSHOTS = 40;
const INTERVAL_MS = 3 * 60 * 1000; // periodic autosave
const SIGNIFICANT_CHARS = 300; // significant text change

const key = (docId: string) => `nb:versions:${docId}`;

function read(docId: string): Snapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(docId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Snapshot => !!s && typeof s.id === "string" && typeof s.body === "string")
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_SNAPSHOTS);
  } catch {
    return [];
  }
}

function write(docId: string, snaps: Snapshot[]) {
  try {
    window.localStorage.setItem(key(docId), JSON.stringify(snaps.slice(0, MAX_SNAPSHOTS)));
  } catch {
    /* quota — ignore */
  }
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Keeps timestamped local snapshots of a document: one every few minutes and
 * one whenever the text changes significantly since the last snapshot.
 */
export function useVersionHistory(docId: string, title: string, body: string) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const latest = useRef({ title, body });
  latest.current = { title, body };
  const lastSavedBody = useRef<string | null>(null);

  useEffect(() => {
    const existing = read(docId);
    setSnapshots(existing);
    lastSavedBody.current = existing[0]?.body ?? null;
  }, [docId]);

  const capture = useCallback(
    (force = false) => {
      const { title: tl, body: bd } = latest.current;
      if (!bd.trim()) return;
      const prev = lastSavedBody.current;
      if (!force && prev !== null && Math.abs(bd.length - prev.length) < SIGNIFICANT_CHARS && bd === prev) return;
      if (prev === bd) return;
      const snap: Snapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        words: countWords(bd),
        title: tl,
        body: bd,
      };
      lastSavedBody.current = bd;
      setSnapshots((xs) => {
        const next = [snap, ...xs].slice(0, MAX_SNAPSHOTS);
        write(docId, next);
        return next;
      });
    },
    [docId],
  );

  // Significant-change trigger
  useEffect(() => {
    const prev = lastSavedBody.current;
    if (prev === null) {
      if (body.trim()) capture(true);
      return;
    }
    if (Math.abs(body.length - prev.length) >= SIGNIFICANT_CHARS) capture(true);
  }, [body, capture]);

  // Periodic trigger
  useEffect(() => {
    const id = window.setInterval(() => capture(false), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [capture]);

  const remove = useCallback(
    (id: string) => {
      setSnapshots((xs) => {
        const next = xs.filter((x) => x.id !== id);
        write(docId, next);
        return next;
      });
    },
    [docId],
  );

  return { snapshots, capture, remove };
}
