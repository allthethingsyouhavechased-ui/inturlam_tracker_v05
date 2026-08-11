"use client";

import Icon from "@/components/ui/Icon";
import { useSidebar } from "./SidebarContext";

export default function SidebarToggle() {
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
      title={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
      aria-expanded={!collapsed}
      aria-controls="app-sidebar"
      className="ui-press hidden size-10 shrink-0 items-center justify-center rounded-[10px] text-secondary hover:bg-surface-hover hover:text-foreground md:flex"
    >
      <Icon name="panel" className="size-[18px] text-muted" />
    </button>
  );
}
