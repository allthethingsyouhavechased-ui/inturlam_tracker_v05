"use client";

import { useState } from "react";
import TaskBoard from "@/components/TaskBoard";
import TaskGridCard from "@/components/TaskGridCard";
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

// Panom'un iki bölümü (bana atanmışlar + ekipte gecikmiş/bu hafta) tek bir
// Pano/Liste düğmesiyle birlikte görünüm değiştirir — /tasks'taki alışkanlığın
// aynısı. Liste görünümü sütun başlıklarından sıralanabilir (TaskListView).
export default function PanomViews({
  myTasks,
  otherTasks,
  people,
  hasIdentity,
  initialView,
}: {
  myTasks: TaskWithContext[];
  otherTasks: TaskWithContext[];
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

      {otherTasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Ekipte gecikmiş / bu hafta teslim ({otherTasks.length})
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Bu görevler başkalarına atanmış ya da hiç atanmamış — takip için burada.
            </p>
            {/* Kimlik seçilmemişken üstteki bölüm hiç çizilmiyor; tek görünüm
                düğmesi o zaman buraya iner. */}
            {!hasIdentity && toggle}
          </div>
          {view === "pano" ? (
            // Bilinçli olarak sürüklenemez: bu bölüm başkasının işi, Panom'dan
            // durum değiştirmek yerine görünürlük sağlıyor.
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {otherTasks.map((t) => (
                <TaskGridCard key={t.id} task={t} badges={t.badges} />
              ))}
            </div>
          ) : (
            <TaskListView tasks={otherTasks} people={people} />
          )}
        </section>
      )}
    </div>
  );
}
