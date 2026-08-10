import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import PanomViews from "@/components/PanomViews";
import PersonalDeadlineRadar from "@/components/PersonalDeadlineRadar";
import SilentAccountsCard from "@/components/SilentAccountsCard";
import { SOCIAL_SILENCE_DAYS } from "@/lib/social";
import { getLatestSyncRun, listBrandSocialRows } from "@/lib/repositories/social";
import { classifySocial } from "@/lib/socialSilence";
import { currentWeekRange, todayISO } from "@/lib/date";
import { getCurrentPerson } from "@/lib/identity";
import { listBrandsWithOpenCounts } from "@/lib/repositories/brands";
import { listUnreadTaskIdsForPerson } from "@/lib/repositories/notifications";
import { listPersonalTaskTargets } from "@/lib/repositories/personalTargets";
import { listActivePeople } from "@/lib/repositories/people";
import {
  listBoardTasksByAssignee,
  listOverdueTasks,
  listTasksDueThisWeek,
  sweepArchivablePublishedTasks,
} from "@/lib/repositories/tasks";
import { archiveCountdownBadge } from "@/lib/taskArchive";
import type { TaskCardBadge, TaskWithContext, TaskWithPersonalTarget } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERSONAL_DEADLINE_HORIZON_DAYS = 7;

const BADGE_OVERDUE: TaskCardBadge = {
  label: "Gecikmiş",
  className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};
const BADGE_THIS_WEEK: TaskCardBadge = {
  label: "Bu hafta",
  className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};
// Görev güncellendiğinde (detay/not düzenleme, yorum) sahibine ve ekibine
// giden bildirimin panodaki karşılığı — dikkat çeksin diye diğer rozetlerden
// (gecikmiş=kırmızı, bu hafta=amber, öncelik/arşiv=slate-cyan-orange-amber)
// bilerek farklı bir renk ailesi (violet) kullanılıyor.
const BADGE_UPDATED: TaskCardBadge = {
  label: "🔔 Güncellendi",
  className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export default async function PanomPage() {
  const me = await getCurrentPerson();
  const today = todayISO();
  const weekEnd = currentWeekRange().end;

  // Süresi dolan yayınlanmış işleri okumadan ÖNCE arşive al — yoksa bu render'da
  // bir kez daha "Yayınlandı" sütununda görünürlerdi.
  sweepArchivablePublishedTasks();

  const myTasks = me ? listBoardTasksByAssignee(me.id) : [];
  const overdue = listOverdueTasks(today);
  const thisWeek = listTasksDueThisWeek(today, weekEnd);
  const personalTargets = me ? listPersonalTaskTargets(me.id) : [];
  const targetByTask = new Map(
    personalTargets.map((target) => [target.task_id, target.target_date]),
  );
  const myPlanningTasks: TaskWithPersonalTarget[] = myTasks
    .filter((task) => task.status !== "Yayinlandi")
    .map((task) => ({
      ...task,
      personal_target_date: targetByTask.get(task.id) ?? null,
    }));
  const brands = listBrandsWithOpenCounts();
  const people = listActivePeople();

  // Sosyal medya takibi: sessiz hesaplar + taramanın kendi sağlığı. Sınıflandırma
  // /social sayfasıyla AYNI fonksiyondan geliyor, yoksa iki ekran farklı şey
  // söyleyebilirdi.
  const socialRows = listBrandSocialRows();
  const socialHealth = socialRows.map((row) => ({
    row,
    health: classifySocial(row, SOCIAL_SILENCE_DAYS, today),
  }));
  const silentAccounts = socialHealth
    .filter((item) => item.health === "silent")
    .map((item) => item.row);
  const brokenAccounts = socialHealth.filter(
    (item) => item.health === "error" || item.health === "unknown",
  ).length;
  const lastSocialRun = getLatestSyncRun();

  const myIds = new Set(myTasks.map((t) => t.id));
  const overdueIds = new Set(overdue.map((t) => t.id));
  const thisWeekIds = new Set(thisWeek.map((t) => t.id));
  // Bu kişi için okunmamış görev bildirimlerinin bağlı olduğu görevler —
  // "🔔 Güncellendi" rozetini basmak için. Görevi açmak bildirimi okundu
  // yapar (bkz. app/tasks/[taskId]/page.tsx), rozet böylece kaybolur.
  const updatedIds = me ? listUnreadTaskIdsForPerson(me.id) : new Set<string>();

  // Panom = "benim board'um": ANA board YALNIZCA bana atanmış açık görevleri
  // gösterir. Rozetler bu yüzden "neden buradayım"ı değil aciliyeti anlatır
  // (Gecikmiş / Bu hafta) — hepsi zaten benim olduğu için "Benim" rozeti yok.
  // Rozetler sunucuda düz veri olarak task'a iliştirilir: Server Component'ten
  // Client Component'e fonksiyon geçirilemediği için (RSC kısıtı) callback
  // yerine bunu tercih ediyoruz.
  function badgesFor(task: TaskWithContext): TaskCardBadge[] {
    const badges: TaskCardBadge[] = [];
    if (updatedIds.has(task.id)) badges.push(BADGE_UPDATED);
    if (overdueIds.has(task.id)) badges.push(BADGE_OVERDUE);
    if (thisWeekIds.has(task.id)) badges.push(BADGE_THIS_WEEK);
    const countdown = archiveCountdownBadge(task);
    if (countdown) badges.push(countdown);
    return badges;
  }

  const myBoardTasks: TaskWithContext[] = myTasks.map((t) => ({
    ...t,
    badges: badgesFor(t),
    personal_target_date: targetByTask.get(t.id) ?? null,
  }));

  // İkinci bölüm: bana atanmamış ama portföyde gecikmiş / bu hafta teslim olan
  // görevler. Ayrı ve açıkça etiketli duruyor ki üstteki board'un "bana
  // atanmış" vaadini bulandırmasın — sürüklenebilir değil, sadece görünürlük.
  const othersMap = new Map<string, TaskWithContext>();
  for (const t of [...overdue, ...thisWeek]) {
    if (myIds.has(t.id)) continue;
    othersMap.set(t.id, { ...t, badges: badgesFor(t) });
  }
  const otherTasks = [...othersMap.values()].sort((a, b) =>
    (a.due_date ?? "").localeCompare(b.due_date ?? ""),
  );

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <h1 className="text-2xl font-semibold tracking-tight">
        Panom{" "}
        {me && <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">· {me.name}</span>}
      </h1>

      {!me && (
        <section className="rounded-xl border border-black/10 bg-white p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">
          Panom sana atanmış görevleri gösterir — önce{" "}
          <Link href="/whoami" className="font-medium text-brand-600 dark:text-brand-400">
            kim olduğunu seç
          </Link>
          . Ekipte gecikmiş ve bu hafta teslim olacak görevler zaten aşağıda.
        </section>
      )}

      {me && (
        <PersonalDeadlineRadar
          personId={me.id}
          tasks={myPlanningTasks}
          today={today}
          horizonDays={PERSONAL_DEADLINE_HORIZON_DAYS}
        />
      )}

      <SilentAccountsCard
        silent={silentAccounts}
        brokenCount={brokenAccounts}
        thresholdDays={SOCIAL_SILENCE_DAYS}
        syncBroken={lastSocialRun?.status === "error"}
      />

      <PanomViews
        myTasks={myBoardTasks}
        otherTasks={otherTasks}
        people={people}
        hasIdentity={Boolean(me)}
      />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Markalara göre açık görevler
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {brands
            .filter((b) => b.open_count > 0)
            .map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.id}`}
                className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-2 text-sm transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-brand-800"
              >
                <span className="font-medium">{b.name}</span>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-100 px-2 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {b.open_count}
                </span>
              </Link>
            ))}
        </div>
        {brands.every((b) => b.open_count === 0) && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Hiç açık görev yok.</p>
        )}
      </section>
    </div>
  );
}
