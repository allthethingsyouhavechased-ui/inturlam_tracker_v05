"use client";

import { useState } from "react";
import TaskBoard, { type SortKey } from "@/components/TaskBoard";
import TaskListView, {
  DEFAULT_TASK_LIST_COLUMNS,
  TaskListColumnsControl,
  type ListColumn,
} from "@/components/TaskListView";
import WorkspaceViewToggle from "@/components/WorkspaceViewToggle";
import { controlClass } from "@/components/ui/Input";
import type { Person, TaskWithContext } from "@/lib/types";
import {
  PANOM_VIEW_PREFERENCE,
  rememberWorkspaceView,
  type WorkspaceView,
} from "@/lib/uiPreferences";

type View = WorkspaceView;

const PANOM_SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "varsayilan", label: "Varsayılan" },
  { key: "marka", label: "Marka" },
  { key: "oncelik", label: "Öncelik" },
  { key: "atanan", label: "Atanan" },
];

// Panom yalnızca kişisel çalışma alanıdır. Ekip geneli riskleri Bugün ve Görevler
// sayfalarında kalır; buradaki düğme kişinin kendi işlerinin görünümünü değiştirir.
export default function PanomViews({
  myTasks,
  people,
  hasIdentity,
  initialView,
  canDeleteTasks = false,
}: {
  myTasks: TaskWithContext[];
  people: Person[];
  hasIdentity: boolean;
  initialView: View;
  canDeleteTasks?: boolean;
}) {
  const [view, setView] = useState<View>(initialView);
  const [sortKey, setSortKey] = useState<SortKey>("varsayilan");
  const [taskListColumns, setTaskListColumns] = useState<ReadonlySet<ListColumn>>(
    () => new Set(DEFAULT_TASK_LIST_COLUMNS),
  );

  function changeView(next: View) {
    setView(next);
    rememberWorkspaceView(PANOM_VIEW_PREFERENCE, next);
  }

  return (
    <div>
      {hasIdentity && (
        <section className="space-y-3">
          <div
            role="group"
            aria-label="Kişisel görev görünümü araçları"
            className="flex min-h-16 min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border-default bg-surface p-3"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-muted">Sırala</span>
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                aria-label="Kişisel görevleri sırala"
                className={controlClass("w-36 sm:w-44")}
              >
                {PANOM_SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="ml-auto flex shrink-0 items-center gap-3 sm:border-l sm:border-border-subtle sm:pl-3">
              {view === "liste" && (
                <span className="hidden md:block">
                  <TaskListColumnsControl
                    visibleColumns={taskListColumns}
                    onChange={setTaskListColumns}
                  />
                </span>
              )}
              <WorkspaceViewToggle view={view} onChange={changeView} />
            </div>
          </div>

          {/* Yayınlananlar da burada: “Yayınlandı” sütununda bir süre daha
              durup sonra arşive düşerler; yanlışlıkla oraya sürüklenen kart
              geri sürüklenebilsin. */}
          {myTasks.length === 0 ? (
            <p className="py-3 text-sm text-muted">Sana atanmış görev yok. 🎉</p>
          ) : view === "pano" ? (
            <TaskBoard
              tasks={myTasks}
              people={people}
              canDeleteTasks={canDeleteTasks}
              sortKey={sortKey}
              boardId="panom"
            />
          ) : (
            <>
              <TaskListView
                tasks={myTasks}
                people={people}
                canDeleteTasks={canDeleteTasks}
                visibleColumns={taskListColumns}
                onVisibleColumnsChange={setTaskListColumns}
                showColumnsControl={false}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
