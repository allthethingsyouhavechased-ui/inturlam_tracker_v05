import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PlanCellSelect from "@/components/PlanCellSelect";
import { hashColor } from "@/lib/colorHash";
import {
  formatMonthLabel,
  monthParamISO,
  monthParamToDate,
  monthWeeks,
  shiftMonthParam,
  todayISO,
  weekIndexForDate,
  WEEKDAY_LABELS,
} from "@/lib/date";
import { listBrands } from "@/lib/repositories/brands";
import { listBrandContentTargets, listPlanEntriesInRange } from "@/lib/repositories/socialPlan";
import {
  CONTENT_KINDS,
  CONTENT_KIND_LABEL,
  countKindsInCombos,
  emptyKindRecord,
} from "@/lib/socialPlan";
import type { ContentKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const WEEK_PARAM_RE = /^\d+$/;

export default async function SocialTakvimPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; hafta?: string }>;
}) {
  const sp = await searchParams;
  const monthDate = monthParamToDate(sp.month);
  const monthParam = monthParamISO(monthDate);
  const weeks = monthWeeks(monthDate);

  // Geçersiz/aralık dışı ?hafta= sessizce yok sayılır (sayfa 500 vermesin,
  // bkz. /calendar'daki ?month= doğrulama deseni). Varsayılan: bugünün
  // düştüğü hafta bu ayın haftalarından biriyse o, değilse ayın ilk haftası.
  const requestedWeek =
    sp.hafta && WEEK_PARAM_RE.test(sp.hafta) ? Number(sp.hafta) : null;
  const defaultWeekIndex = weekIndexForDate(monthDate, todayISO()) ?? 1;
  const selectedIndex =
    requestedWeek && requestedWeek >= 1 && requestedWeek <= weeks.length
      ? requestedWeek
      : defaultWeekIndex;
  const selectedWeek = weeks[selectedIndex - 1] ?? weeks[0];

  const brands = listBrands();

  // Tek sorgu, ayın TÜM haftalarını kapsar (ilk haftanın Pazartesi'sinden son
  // haftanın Pazar'ına) — hem seçili haftanın ızgarasını hem sağdaki aylık
  // özeti besler.
  const monthEntries = listPlanEntriesInRange(weeks[0].start, weeks[weeks.length - 1].end);
  const comboByKey = new Map(monthEntries.map((e) => [`${e.brand_id}|${e.plan_date}`, e.combo]));
  const combosByBrand = new Map<string, string[]>();
  for (const entry of monthEntries) {
    const list = combosByBrand.get(entry.brand_id) ?? [];
    list.push(entry.combo);
    combosByBrand.set(entry.brand_id, list);
  }

  const targetsByBrand = new Map<string, Record<ContentKind, number>>();
  for (const row of listBrandContentTargets()) {
    if (!targetsByBrand.has(row.brand_id)) targetsByBrand.set(row.brand_id, emptyKindRecord());
    targetsByBrand.get(row.brand_id)![row.kind as ContentKind] = row.monthly_target;
  }

  const monthHref = (delta: number) => `/social/takvim?month=${shiftMonthParam(monthParam, delta)}`;
  const weekHref = (index: number) => `/social/takvim?month=${monthParam}&hafta=${index}`;

  return (
    // NOT: `team-page-wide` (1600px geniş kabuk) burada İŞE YARAMAZ — o sınıf
    // `.page-shell`'in DOĞRUDAN çocuğunu arıyor (`:has(> .team-page-wide)`),
    // ama app/social/layout.tsx araya kendi sarmalayıcısını (SocialTabs +
    // bu div) koyduğu için artık torun oluyor. Tablo zaten kendi
    // `overflow-x-auto` sarmalayıcısıyla yatay kaydırıyor, standart genişlik
    // yeterli — global CSS'i tek sayfa için karmaşıklaştırmaya değmez.
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Paylaşım Takvimi</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Marka başına haftalık paylaşım planı. Hücreye tıklayıp o gün planlanan türü seç.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900">
          <Link
            href={monthHref(-1)}
            aria-label="Önceki ay"
            className="ui-press touch-target grid size-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            ‹
          </Link>
          <span className="min-w-28 text-center font-medium tabular-nums">
            {formatMonthLabel(monthDate)}
          </span>
          <Link
            href={monthHref(1)}
            aria-label="Sonraki ay"
            className="ui-press touch-target grid size-8 place-items-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
          >
            ›
          </Link>
        </div>
      </div>

      <nav aria-label="Hafta seçimi" className="flex flex-wrap gap-1.5">
        {weeks.map((week) => (
          <Link
            key={week.index}
            href={weekHref(week.index)}
            aria-current={week.index === selectedIndex ? "page" : undefined}
            className={`ui-press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
              week.index === selectedIndex
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-black/10 bg-white text-zinc-600 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10"
            }`}
          >
            {week.index}. Hafta
            <span
              className={
                week.index === selectedIndex
                  ? "text-white/75"
                  : "text-zinc-500 dark:text-zinc-400"
              }
            >
              {week.label}
            </span>
          </Link>
        ))}
      </nav>

      {brands.length === 0 ? (
        <EmptyState
          title="Takip edilecek marka yok"
          description="Aktif bir marka eklendiğinde paylaşım takvimi burada başlar."
        />
      ) : (
        <section className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 font-medium dark:bg-zinc-900">
                  Marka
                </th>
                {selectedWeek.days.map((day, i) => (
                  <th key={day.date} className="px-2 py-2 font-medium">
                    <div>{WEEKDAY_LABELS[i]}</div>
                    <div className="font-normal normal-case tabular-nums text-zinc-400 dark:text-zinc-500">
                      {day.date.slice(8, 10)}
                    </div>
                  </th>
                ))}
                {CONTENT_KINDS.map((kind) => (
                  <th key={kind} className="px-3 py-2 font-medium">
                    {CONTENT_KIND_LABEL[kind]} (ay)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => {
                const planned = countKindsInCombos(combosByBrand.get(brand.id) ?? []);
                const targets = targetsByBrand.get(brand.id) ?? emptyKindRecord();
                return (
                  <tr
                    key={brand.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-zinc-900">
                      <Link
                        href={`/brands/${brand.id}`}
                        className={`inline-block max-w-40 truncate rounded-md px-2 py-1 text-xs font-semibold ${hashColor(brand.name)}`}
                      >
                        {brand.name}
                      </Link>
                    </td>
                    {selectedWeek.days.map((day) => (
                      <td key={day.date} className="px-1.5 py-1.5">
                        <PlanCellSelect
                          brandId={brand.id}
                          date={day.date}
                          combo={comboByKey.get(`${brand.id}|${day.date}`) ?? null}
                        />
                      </td>
                    ))}
                    {CONTENT_KINDS.map((kind) => {
                      const reached = targets[kind] > 0 && planned[kind] >= targets[kind];
                      return (
                        <td
                          key={kind}
                          className={`px-3 py-2 text-xs font-medium tabular-nums ${
                            reached
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          {planned[kind]}/{targets[kind]}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
