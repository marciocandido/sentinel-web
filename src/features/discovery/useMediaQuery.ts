import { useCallback, useSyncExternalStore } from "react";

/** Viewport estreita: resultados em cards, não em tabela horizontal. */
export const NARROW_VIEWPORT_QUERY = "(max-width: 720px)";

function mediaQueryList(query: string): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query)
    : null;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const list = mediaQueryList(query);
    list?.addEventListener?.("change", notify);
    return () => list?.removeEventListener?.("change", notify);
  }, [query]);
  return useSyncExternalStore(
    subscribe,
    () => mediaQueryList(query)?.matches ?? false,
    () => false,
  );
}
