"use client";

// Hydration-safe mount guard (no setState-in-effect; SSR renders false).
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
