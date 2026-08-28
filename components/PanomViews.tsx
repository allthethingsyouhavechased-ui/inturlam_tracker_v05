"use client";

import { useState } from "react";
import TaskBoard from "@/components/TaskBoard";
import TaskListView, {
  DEFAULT_TASK_LIST_COLUMNS,
  TaskListColumnsControl,
  type ListColumn,
} from "@/components/TaskListView";
import WorkspaceViewToggle from "@/components/WorkspaceViewToggle";
import type { Person, TaskWithContext } from "@/lib/types";
import {
  PANOM_VIEW_PREFERENCE,
  rememberWorkspaceView,
  type WorkspaceView,
} from "@/lib/uiPreferences";

type View = WorkspaceView;

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
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-eyebrow text-muted">
              Bana atanmış görevler{" "}
              {myTasks.length > 0 && <span>({myTasks.length})</span>}
            </h2>
            <div
              role="group"
              aria-label="Bana atanmış görev görünümü araçları"
              className="ml-auto flex items-center gap-2"
            >
              <WorkspaceViewToggle view={view} onChange={changeView} />
              {view === "liste" && (
                <div className="hidden md:block">
                  <TaskListColumnsControl
                    visibleColumns={taskListColumns}
                    onChange={setTaskListColumns}
                  />
                </div>
              )}
            </div>
          </header>

          {/* Yayınlananlar da burada: “Yayınlandı” sütununda bir süre daha
              durup sonra arşive düşerler; yanlışlıkla oraya sürüklenen kart
              geri sürüklenebilsin. */}
          {myTasks.length === 0 ? (
            <p className="py-3 text-sm text-muted">Sana atanmış görev yok. 🎉</p>
          ) : view === "pano" ? (
            <TaskBoard tasks={myTasks} people={people} boardId="panom" />
          ) : (
            <TaskListView
              tasks={myTasks}
              people={people}
              canDeleteTasks={canDeleteTasks}
              visibleColumns={taskListColumns}
              onVisibleColumnsChange={setTaskListColumns}
              showColumnsControl={false}
            />
          )}
        </section>
      )}
    </div>
  );
}
