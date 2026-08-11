"use client";

import Icon from "@/components/ui/Icon";
import { useSidebar } from "./SidebarContext";

export default function MobileMenuButton() {
  const { open, toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
      aria-expanded={open}
      aria-controls="app-sidebar"
      className="ui-press inline-flex size-10 items-center justify-center rounded-[10px] text-secondary hover:bg-surface-hover hover:text-foreground md:hidden"
    >
      <Icon name={open ? "close" : "panel"} className="size-[19px]" />
    </button>
  );
}
