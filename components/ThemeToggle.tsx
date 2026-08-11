"use client";

import { useSyncExternalStore } from "react";
import Icon from "@/components/ui/Icon";

function subscribe(callback: () => void): () => void {
  window.addEventListener("themechange", callback);
  return () => window.removeEventListener("themechange", callback);
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, () => false);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Tema bu oturumda yine uygulanır; yalnızca tercih kalıcı olmaz.
    }
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={dark ? "Açık tema" : "Koyu tema"}
      className="touch-target ui-press inline-flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-hover hover:text-foreground"
    >
      <Icon name={dark ? "sun" : "moon"} className="size-[18px]" />
    </button>
  );
}
