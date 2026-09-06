"use client";

import { useState, useSyncExternalStore } from "react";
import TaskBoard, { type SortKey } from "@/components/TaskBoard";
import TaskListView, {
  ALL_TASK_LIST_COLUMNS,
  DEFAULT_TASK_LIST_COLUMNS,
  TaskListColumnsControl,
} from "@/components/TaskListView";
import WorkspaceViewToggle from "@/components/WorkspaceViewToggle";
import { controlClass } from "@/components/ui/Input";
import type { Person, TaskWithContext } from "@/lib/types";
import {
  PANOM_VIEW_PREFERENCE,
  rememberWorkspaceView,
  type WorkspaceView,
} from "@/lib/uiPreferences";
import { useTaskListColumns } from "@/lib/useTaskListColumns";
import { matchesPersonalFocus, personalFocusCounts, PERSONAL_FOCUS_LABELS, type PersonalFocus } from "@/lib/workQueues";

function subscribeViewport(callback: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const readNarrow = () => window.matchMedia("(max-width: 767px)").matches;
const serverNarrow = () => false;
const noSubscribe = () => () => {};

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
  hasViewPreference = true,
  personId,
  today,
  canDeleteTasks = false,
}: {
  myTasks: TaskWithContext[];
  people: Person[];
  hasIdentity: boolean;
  initialView: View;
  hasViewPreference?: boolean;
  personId: string;
  today: string;
  canDeleteTasks?: boolean;
}) {
  const [chosenView, setView] = useState<View | null>(hasViewPreference ? initialView : null);
  const narrow = useSyncExternalStore(subscribeViewport, readNarrow, serverNarrow);
  const view = chosenView ?? (narrow ? "liste" : "pano");
  const preferenceKey = `inturlam.ui.panomFocus.${personId}`;
  const storedFocus = useSyncExternalStore(noSubscribe, () => {
    try { return window.localStorage.getItem(preferenceKey); } catch { return null; }
  }, () => null);
  const [chosenFocus, setFocus] = useState<PersonalFocus | null>(null);
  const focus: PersonalFocus = chosenFocus ?? (storedFocus && Object.hasOwn(PERSONAL_FOCUS_LABELS, storedFocus) ? storedFocus as PersonalFocus : "all");
  const counts = personalFocusCounts(myTasks, today);
  const visibleTasks = myTasks.filter((task) => matchesPersonalFocus(task, focus, today));
  const [sortKey, setSortKey] = useState<SortKey>("varsayilan");
  const [taskListColumns, setTaskListColumns, taskListLayout] = useTaskListColumns(
    "panom",
    DEFAULT_TASK_LIST_COLUMNS,
    ALL_TASK_LIST_COLUMNS,
  );

  function changeView(next: View) {
    setView(next);
    rememberWorkspaceView({ cookie: `${PANOM_VIEW_PREFERENCE.cookie}_${personId}`, storage: `${PANOM_VIEW_PREFERENCE.storage}.${personId}` }, next);
  }

  function changeFocus(next: PersonalFocus) {
    setFocus(next);
    try { window.localStorage.setItem(preferenceKey, next); } catch { /* Selection remains usable without storage. */ }
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
            <label className="flex min-w-0 shrink-0 items-center gap-2">
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

            <div role="group" aria-label="Kişisel iş kuyrukları" className="flex min-w-0 flex-wrap gap-2 xl:flex-nowrap">
              {(Object.keys(PERSONAL_FOCUS_LABELS) as PersonalFocus[]).map((key) => <button key={key} type="button" aria-pressed={focus === key} onClick={() => changeFocus(key)}
                className={`min-h-11 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium ${focus === key ? "border-brand-500 bg-brand-600 text-white" : "border-border-default bg-surface text-secondary hover:bg-surface-hover"}`}>
                {PERSONAL_FOCUS_LABELS[key]} <span className="ml-1 tabular-nums">{counts[key]}</span>
              </button>)}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-3 sm:border-l sm:border-border-subtle sm:pl-3">
              {view === "liste" && (
                <span className="hidden md:block">
                  <TaskListColumnsControl
                    visibleColumns={taskListColumns}
                    onChange={setTaskListColumns}
                    onResetLayout={taskListLayout.resetLayout}
                  />
                </span>
              )}
              <WorkspaceViewToggle view={view} onChange={changeView} />
            </div>
          </div>

          {/* Yayınlananlar da burada: “Yayınlandı” sütununda bir süre daha
              durup sonra arşive düşerler; yanlışlıkla oraya sürüklenen kart
              geri sürüklenebilsin. */}
          {visibleTasks.length === 0 ? (
            <p className="py-3 text-sm text-muted">Bu görünümde görev yok.</p>
          ) : view === "pano" ? (
            <TaskBoard
              tasks={visibleTasks}
              people={people}
              canDeleteTasks={canDeleteTasks}
              sortKey={sortKey}
              boardId="panom"
            />
          ) : (
            <>
              <TaskListView
                tasks={visibleTasks}
                people={people}
                canDeleteTasks={canDeleteTasks}
                visibleColumns={taskListColumns}
                onVisibleColumnsChange={setTaskListColumns}
                layout={taskListLayout}
                showColumnsControl={false}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
