"use client";

import { useState } from "react";
import TaskBoard from "@/components/TaskBoard";
import TaskListView from "@/components/TaskListView";
import type { Person, TaskWithContext } from "@/lib/types";
import {
  PANOM_VIEW_PREFERENCE,
  rememberWorkspaceView,
  type WorkspaceView,
} from "@/lib/uiPreferences";

type View = WorkspaceView;

// Görünüm düğmesi bölüm başlığının sağında duruyor (eskiden sayfanın en
// üstünde, tek başına bir satırdaydı) — hangi listeyi değiştirdiği başlıkla
// yan yana dururken belli oluyor ve panonun üstündeki boşluk kalkıyor.
function ViewToggle({
  view,
  onChange,
}: {
  view: View;
  onChange: (next: View) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Görev görünümü"
      className="inline-flex shrink-0 overflow-hidden rounded-xl border border-black/10 bg-white p-0.5 text-xs shadow-sm dark:border-white/15 dark:bg-zinc-950"
    >
      {(["pano", "liste"] as const).map((next) => (
        <button
          key={next}
          type="button"
          onClick={() => onChange(next)}
          aria-pressed={view === next}
          className={`ui-press min-h-10 rounded-lg px-3 font-medium ${
            view === next
              ? "bg-brand-600 text-white"
              : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
          }`}
        >
          {next === "pano" ? "Pano" : "Liste"}
        </button>
      ))}
    </div>
  );
}

// Panom yalnızca kişisel çalışma alanıdır. Ekip geneli riskleri Bugün ve Görevler
// sayfalarında kalır; buradaki düğme kişinin kendi işlerinin görünümünü değiştirir.
export default function PanomViews({
  myTasks,
  people,
  hasIdentity,
  initialView,
}: {
  myTasks: TaskWithContext[];
  people: Person[];
  hasIdentity: boolean;
  initialView: View;
}) {
  const [view, setView] = useState<View>(initialView);
  function changeView(next: View) {
    setView(next);
    rememberWorkspaceView(PANOM_VIEW_PREFERENCE, next);
  }

  // Düğme tek: hangi bölüm önce çiziliyorsa onun başlığında durur. Kimlik
  // seçilmemişken üst bölüm hiç render edilmiyor, düğme de aşağıya iner.
  const toggle = <ViewToggle view={view} onChange={changeView} />;

  return (
    <div className="space-y-8">
      {hasIdentity && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Bana atanmış görevler{" "}
            {myTasks.length > 0 && <span>({myTasks.length})</span>}
          </h2>
          {/* Yayınlananlar da burada: “Yayınlandı” sütununda bir süre daha
              durup sonra arşive düşerler — yanlışlıkla oraya sürüklenen kart
              geri sürüklenebilsin diye.
              Görünüm düğmesi board'un "Sırala:" satırının sağ ucunda duruyor;
              liste/boş durumda da aynı hizada kalsın diye kendi satırına
              çekiliyor. */}
          {myTasks.length === 0 ? (
            <>
              <div className="flex justify-end">{toggle}</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Sana atanmış görev yok. 🎉</p>
            </>
          ) : view === "pano" ? (
            <TaskBoard tasks={myTasks} boardId="panom" toolbar={toggle} />
          ) : (
            <>
              <div className="flex justify-end">{toggle}</div>
              <TaskListView tasks={myTasks} people={people} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
