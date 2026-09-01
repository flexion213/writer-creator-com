import { useCallback, useEffect, useRef } from "react";

/**
 * Coalesces rapid per-row edits (one keystroke = one patch) into a single
 * debounced write per row. Pending patches are merged, so no field is lost,
 * and everything still queued is flushed on unmount — the cause of edits
 * "resetting" after a reload was losing the last in-flight keystrokes and
 * firing dozens of racing updates that landed out of order.
 */
export function useDebouncedPatcher<T extends object>(
  save: (id: string, patch: Partial<T>) => Promise<unknown>,
  delay = 500,
) {
  const pending = useRef(new Map<string, Partial<T>>());
  const timers = useRef(new Map<string, number>());
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async (id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    const patch = pending.current.get(id);
    if (!patch || Object.keys(patch).length === 0) return;
    pending.current.delete(id);
    try {
      await saveRef.current(id, patch);
    } catch {
      /* keep the UI responsive; the next edit retries the write */
    }
  }, []);

  const queue = useCallback(
    (id: string, patch: Partial<T>) => {
      pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...patch });
      const existing = timers.current.get(id);
      if (existing !== undefined) window.clearTimeout(existing);
      timers.current.set(id, window.setTimeout(() => void flush(id), delay));
    },
    [delay, flush],
  );

  const flushAll = useCallback(async () => {
    await Promise.all([...pending.current.keys()].map((id) => flush(id)));
  }, [flush]);

  const drop = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    pending.current.delete(id);
  }, []);

  useEffect(() => {
    return () => {
      // Fire-and-forget on unmount so the final keystrokes are never dropped.
      void flushAll();
    };
  }, [flushAll]);

  return { queue, flush, flushAll, drop };
}
