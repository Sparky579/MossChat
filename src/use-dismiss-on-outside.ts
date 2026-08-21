import { useEffect, type RefObject } from "react";

/** Closes a transient menu when focus moves outside it or the user presses Escape. */
export function useDismissOnOutside<T extends HTMLElement>(open: boolean, root: RefObject<T | null>, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onDismiss(); };
    const dismissEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onDismiss(); };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [onDismiss, open, root]);
}
