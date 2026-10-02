// Continuous autosave (CLAUDE.md "Data entry"). Every edit is saved after a
// short pause; pending saves are flushed when a view closes and before the
// window closes (main process asks via onBeforeClose).
import { useCallback, useEffect, useRef, useState } from 'react';

const pendingFlushes = new Set<() => Promise<void>>();

export async function flushAllAutosaves(): Promise<void> {
  await Promise.all([...pendingFlushes].map((flush) => flush()));
}

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface AutosaveStatus {
  state: SaveState;
  savedAt: Date | null;
  error: string | null;
  flush: () => Promise<void>;
}

export function useAutosave<T>(value: T, save: (value: T) => Promise<void>, delayMs = 400): AutosaveStatus {
  const [state, setState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(value);
  const saveRef = useRef(save);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const first = useRef(true);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) await inFlight.current;
    if (!dirty.current) return;
    dirty.current = false;
    setState('saving');
    const run = saveRef
      .current(latest.current)
      .then(() => {
        setState(dirty.current ? 'pending' : 'saved');
        setSavedAt(new Date());
        setError(null);
      })
      .catch((err: unknown) => {
        dirty.current = true;
        setState('error');
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = run;
    await run;
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current = value;
    dirty.current = true;
    setState('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delayMs);
  }, [value, delayMs, flush]);

  useEffect(() => {
    pendingFlushes.add(flush);
    return () => {
      pendingFlushes.delete(flush);
      void flush();
    };
  }, [flush]);

  return { state, savedAt, error, flush };
}
