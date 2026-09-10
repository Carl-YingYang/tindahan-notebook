import { create } from "zustand";
import { useEffect, useRef, useState } from "react";

/**
 * Local consistency model — mirrors the web prototype's
 * "invalidateQueries() after every write":
 * every repo write calls refreshAll(); every screen hook re-reads
 * from SQLite whenever the version changes.
 */

interface BusState {
  version: number;
  bump: () => void;
}

export const useBus = create<BusState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

export function refreshAll(): void {
  useBus.getState().bump();
}

/**
 * Read model hook. `loader` must be a sync function reading from SQLite.
 * Re-runs on version bumps and whenever `deps` change.
 */
export function useDbQuery<T>(loader: () => T, deps: unknown[] = []): T | null {
  const version = useBus((s) => s.version);
  const [data, setData] = useState<T | null>(null);
  const loaderRef = useRef(loader);

  // keep the latest loader without re-triggering the query
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    try {
      setData(loaderRef.current());
    } catch (e) {
      console.warn("[tindahan] query failed", e);
    }
  }, [version, ...deps]);

  return data;
}
