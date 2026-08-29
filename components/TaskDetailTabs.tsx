"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Görev detayı 2026-08-29'a kadar ALTI sekmeydi (ayrıntılar / iş akışı / teslim
// / revize / yorumlar / hareketler). İş akışını görmek için sekme değiştirmek,
// yorumu okumak için bir daha değiştirmek gerekiyordu — üstelik her sekme tek
// başına ekranın yarısını boş bırakıyordu.
//
// Yeni düzen: SEKME olan yalnızca iş akışının "birbirini dışlayan" üç adımı
// (görev ayrıntıları / teslim / revize). İş akışı kontrolleri, yorumlar ve
// hareketler hangi sekme açık olursa olsun YANDA duruyor — teslim veya revize
// ekranındayken de görev durumunu değiştirebil, son yorumu okuyabil diye.
const TABS = [
  { id: "details", hash: "gorev-ayrintilari", label: "Görev ayrıntıları" },
  { id: "delivery", hash: "teslim", label: "Teslim" },
  { id: "revision", hash: "revize", label: "Revize" },
] as const;

type TabId = (typeof TABS)[number]["id"];
/** Yan sütunda duran, sekme OLMAYAN paneller. */
type AsideId = "workflow" | "comments" | "activity";

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
}: Record<TabId | AsideId, ReactNode>) {
  const [activeTab, setActiveTab] = useState<TabId>("details");
  const tabListRef = useRef<HTMLDivElement>(null);
  const panels: Record<TabId, ReactNode> = {
    details,
    delivery,
    revision,
  };

  // Eski derin bağlantılar (#is-akisi, #yorumlar, #hareketler) artık bir sekmeyi
  // değil yan sütundaki bölümü işaret ediyor: tabFromHash null döner, sekme
  // "details"ta kalır, tarayıcı da aynı id'li bölüme kaydırır.
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
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-5">
      <div className="min-w-0 space-y-4">
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Görev bölümleri"
          className="flex min-w-max items-center gap-1 border-b border-border-subtle pb-2"
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

        {/* Yorum yazmak geniş alan ister; yan sütuna sıkıştırılmıyor. */}
        <section id="yorumlar" aria-label="Görev yorumları" className="min-w-0">
          {comments}
        </section>
      </div>

      <aside
        aria-label="Görev iş akışı ve geçmişi"
        className="mt-4 min-w-0 space-y-4 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:mt-0"
      >
        <section id="is-akisi" className="min-w-0">{workflow}</section>
        <section id="hareketler" className="min-w-0">{activity}</section>
      </aside>
    </div>
  );
}
