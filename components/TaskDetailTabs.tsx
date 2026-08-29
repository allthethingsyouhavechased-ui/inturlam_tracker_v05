"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

const TABS = [
  { id: "details", hash: "gorev-ayrintilari", label: "Ayrıntılar" },
  { id: "workflow", hash: "is-akisi", label: "İş akışı" },
  { id: "delivery", hash: "teslim", label: "Teslim" },
  { id: "revision", hash: "revize", label: "Revize" },
  { id: "comments", hash: "yorumlar", label: "Yorumlar" },
  { id: "activity", hash: "hareketler", label: "Hareketler" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function tabFromHash(hash: string): TabId | null {
  const normalizedHash = hash.replace(/^#/, "");
  return TABS.find((tab) => tab.hash === normalizedHash)?.id ?? null;
}

export default function TaskDetailTabs({
  details,
  workflow,
  delivery,
  revision,
  comments,
  activity,
}: Record<TabId, ReactNode>) {
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const tabListRef = useRef<HTMLDivElement>(null);
  const panels: Record<TabId, ReactNode> = {
    details,
    workflow,
    delivery,
    revision,
    comments,
    activity,
  };

  useEffect(() => {
    const syncFromHash = () => {
      const nextTab = tabFromHash(window.location.hash);
      if (nextTab) setActiveTab(nextTab);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectTab(tabId: TabId, focus = false) {
    const tab = TABS.find((candidate) => candidate.id === tabId);
    if (!tab) return;

    setActiveTab(tabId);
    window.history.replaceState(null, "", `#${tab.hash}`);
    if (focus) {
      tabListRef.current
        ?.querySelector<HTMLButtonElement>(`[data-task-tab="${tabId}"]`)
        ?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;

    event.preventDefault();
    selectTab(TABS[nextIndex].id, true);
  }

  const activeDefinition = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-20 -mx-4 mb-5 overflow-x-auto border-y border-border-subtle bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Görev bölümleri"
          className="flex min-w-max items-center gap-1"
        >
          {TABS.map((tab, index) => {
            const selected = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`task-tab-${tab.id}`}
                data-task-tab={tab.id}
                aria-selected={selected}
                aria-controls={`task-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "ui-press inline-flex min-h-9 items-center rounded-lg border px-3 text-xs font-semibold transition-colors",
                  selected
                    ? "border-brand-500/35 bg-brand-500/10 text-brand-700 dark:text-brand-200"
                    : "border-transparent text-secondary hover:border-border-default hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`task-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`task-tab-${activeTab}`}
        data-task-panel={activeTab}
        className="min-w-0"
      >
        <span id={activeDefinition.hash} className="sr-only" aria-hidden="true" />
        {panels[activeTab]}
      </div>
    </div>
  );
}
