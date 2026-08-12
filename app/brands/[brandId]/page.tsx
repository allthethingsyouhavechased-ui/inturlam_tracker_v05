import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityFeed from "@/components/ActivityFeed";
import ArchiveContentButton from "@/components/ArchiveContentButton";
import AutoRefresh from "@/components/AutoRefresh";
import BrandContentTargetsSection from "@/components/BrandContentTargetsSection";
import BrandLogo from "@/components/BrandLogo";
import BrandOperationsOverview from "@/components/BrandOperationsOverview";
import EditBrandForm from "@/components/EditBrandForm";
import NewContentForm from "@/components/NewContentForm";
import QuickAddModal from "@/components/QuickAddModal";
import SocialHealthBadge from "@/components/SocialHealthBadge";
import PageHeader from "@/components/ui/PageHeader";
import {
  CONTENT_STATUS_BADGE,
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
  UNKNOWN_CLUSTER_LABEL,
} from "@/lib/constants";
import { daysAgoISO, formatDateShort, formatIsoDateTime, shiftISODate, shiftMonthParam, todayISO } from "@/lib/date";
import { SOCIAL_SILENCE_DAYS } from "@/lib/social";
import { listBrandSocialRows } from "@/lib/repositories/social";
import { classifySocial } from "@/lib/socialSilence";
import { requirePageSession } from "@/lib/identity";
import { instagramProfileUrl, normalizeInstagramHandle } from "@/lib/instagram";
import { getBrand } from "@/lib/repositories/brands";
import { listActivityForBrand } from "@/lib/repositories/activity";
import { clusterLabelMap, listClusters } from "@/lib/repositories/clusters";
import { listArchivedContentByBrand, listContentByBrand } from "@/lib/repositories/content";
import { listActivePeople } from "@/lib/repositories/people";
import { listBrandPersonAssignments } from "@/lib/repositories/brandAssignments";
import { listCalendarEvents } from "@/lib/repositories/calendarEvents";
import { getBrandMonthlyProgress, listBrandMonthlyContributions } from "@/lib/repositories/progress";
import { getBrandMonthlyContentCompletion, listContentTargetsForBrand } from "@/lib/repositories/socialPlan";
import { listTemplates } from "@/lib/repositories/templates";
import { emptyKindRecord } from "@/lib/socialPlan";
import type { ContentKind } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrandPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const me = await requirePageSession();
  const canManageBrand = me.is_manager === 1;
  const { brandId } = await params;
  const brand = getBrand(brandId);
  if (!brand) notFound();

  const items = listContentByBrand(brandId);
  const archivedItems = listArchivedContentByBrand(brandId);
  const people = listActivePeople();
  const templates = listTemplates();
  const activity = listActivityForBrand(brandId);
  const clusters = listClusters();
  const clusterLabels = clusterLabelMap();
  const contentTargets = emptyKindRecord();
  for (const row of listContentTargetsForBrand(brandId)) {
    contentTargets[row.kind as ContentKind] = row.monthly_target;
  }
  const today = todayISO();
  const month = today.slice(0, 7);
  const monthlyContentCompletion = getBrandMonthlyContentCompletion(brandId, month);
  const assignments = listBrandPersonAssignments(brandId);
  const progress = getBrandMonthlyProgress(brandId, month);
  const contributions = listBrandMonthlyContributions(brandId, month);
  const monthlyContents = items.filter((item) => item.target_date?.slice(0, 7) === month);
  const monthlyEvents = listCalendarEvents({
    rangeStart: `${month}-01`,
    rangeEnd: `${shiftMonthParam(month, 1)}-01`,
    brandId,
  });
  const year = Number(month.slice(0, 4));
  const annualEvents = listCalendarEvents({
    rangeStart: `${year}-01-01`,
    rangeEnd: `${year + 1}-01-01`,
    brandId,
  });
  const upcomingEvents = listCalendarEvents({
    rangeStart: today,
    rangeEnd: shiftISODate(today, 91),
    brandId,
  });
  // Sayılar haftalık tazeleniyor; 7 günden eskiyse (ya da hiç girilmemişse)
  // "tazelenmeli" uyarısı çıkar. Tarihler 'YYYY-MM-DD' olduğu için düz metin
  // karşılaştırması kronolojik sıralamayı doğru verir.
  const staleStats = (brand.stats_updated_at ?? "") < daysAgoISO(7);

  // Instagram kullanıcı adı girilmemiş markalar takip listesinde yok; o zaman
  // rozet de çizilmez (yanlışlıkla "taranmadı" demek yerine hiç bahsetmemek).
  const socialRow = listBrandSocialRows().find((row) => row.brand_id === brandId) ?? null;
  const socialHealth = socialRow
    ? classifySocial(socialRow, SOCIAL_SILENCE_DAYS, today)
    : null;
  const instagramHandle = normalizeInstagramHandle(brand.instagram_handle);
  const instagramUrl = instagramProfileUrl(brand.instagram_handle);

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeader
        className="!mb-0 sm:flex-wrap xl:flex-nowrap"
        eyebrow="MARKA ÇALIŞMA ALANI"
        title={brand.name}
        description={
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span>{clusterLabels[brand.cluster] ?? UNKNOWN_CLUSTER_LABEL}</span>
            {instagramUrl && instagramHandle && (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-secondary underline decoration-border-strong underline-offset-4 hover:text-brand-600 dark:hover:text-brand-300"
                >
                  @{instagramHandle}
                </a>
              </>
            )}
            {brand.tier && <><span aria-hidden="true">·</span><span>Tier {brand.tier}</span></>}
          </span>
        }
        breadcrumb={[{ label: "Markalar", href: "/brands" }, { label: brand.name }]}
        media={<BrandLogo name={brand.name} logoPath={brand.logo_path} size="lg" />}
        summary={
          <section
            aria-label="Marka bilgi özeti"
            className="min-w-0 border-t border-border-subtle pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 lg:pl-5"
          >
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_0.85fr] xl:gap-0">
              <div data-brand-info="summary" className="min-w-0 xl:pr-5">
                <p className="text-[10px] font-semibold tracking-[0.09em] text-faint">MARKA ÖZETİ</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {brand.follower_count != null
                      ? `${brand.follower_count.toLocaleString("tr-TR")} takipçi`
                      : "Takipçi verisi yok"}
                  </span>
                  {brand.post_count != null && (
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {brand.post_count.toLocaleString("tr-TR")} gönderi
                    </span>
                  )}
                  {staleStats && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Tazelenmeli
                    </span>
                  )}
                </div>
                <p
                  className="mt-2 line-clamp-2 text-xs leading-5 text-secondary"
                  title={brand.key_finding ?? undefined}
                >
                  {brand.key_finding?.split("\n")[0] ?? "Kısa marka notu eklenmemiş"}
                </p>
              </div>

              <div
                data-brand-info="targets"
                className="min-w-0 border-t border-border-subtle pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0 xl:px-5"
              >
                <BrandContentTargetsSection
                  brandId={brand.id}
                  brandName={brand.name}
                  targets={contentTargets}
                  month={month}
                  monthlyContentCompleted={Boolean(monthlyContentCompletion)}
                  compact
                />
              </div>

              <div
                data-brand-info="activity"
                className="min-w-0 border-t border-border-subtle pt-4 md:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"
              >
                <p className="text-[9px] font-semibold tracking-[0.08em] text-faint">AKTİFLİK</p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  {socialHealth ? (
                    <>
                      <SocialHealthBadge
                        health={socialHealth}
                        detail={socialRow?.days_silent != null ? `${socialRow.days_silent} gün` : undefined}
                      />
                      <span className="min-w-0 truncate text-xs text-muted">
                        {socialRow?.last_post_at
                          ? `Son paylaşım ${formatIsoDateTime(socialRow.last_post_at)}`
                          : "Paylaşım kaydı yok"}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Takip hesabı bağlanmamış</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        }
        actions={
          <>
            <QuickAddModal
              brands={[{ id: brand.id, name: brand.name }]}
              contents={items.map((item) => ({ id: item.id, brand_id: brand.id, title: item.title }))}
              people={people}
              defaultAssigneeId={me?.id ?? null}
              defaultBrandId={brand.id}
              triggerLabel="Görev oluştur"
            />
            {canManageBrand && <EditBrandForm brand={brand} clusters={clusters} />}
          </>
        }
      />

      <BrandOperationsOverview
        brand={brand}
        month={month}
        assignments={assignments}
        progress={progress}
        contributions={contributions}
        monthlyContents={monthlyContents}
        upcomingEvents={upcomingEvents}
        monthlyShootCount={monthlyEvents.filter((event) => event.type === "Cekim").length}
        annualShootCount={annualEvents.filter((event) => event.type === "Cekim").length}
      />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Projeler ve içerikler ({items.length})
          </h2>
          <details className="group relative">
            <summary className="ui-press flex min-h-9 cursor-pointer list-none items-center rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover hover:text-foreground [&::-webkit-details-marker]:hidden">
              Yeni proje oluştur
            </summary>
            <div className="ui-enter absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[min(62rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-surface p-4 shadow-lg">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">Yeni proje / içerik</h3>
                <p className="mt-1 text-xs text-muted">Birden fazla görevi aynı akışta yöneteceksen proje oluştur. Tek görev için üstteki “Görev oluştur” daha hızlıdır.</p>
              </div>
              <NewContentForm
                brandId={brand.id}
                people={people}
                templates={templates}
                defaultAssigneeId={me?.id ?? null}
              />
            </div>
          </details>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default bg-surface-subtle px-5 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">Bu markada henüz proje yok</p>
            <p className="mt-1 text-xs text-muted">Tek bir iş açacaksan “Görev oluştur”; çok adımlı bir iş akışı için “Yeni proje oluştur”u kullan.</p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-black/10 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
              >
                <Link
                  href={`/brands/${brand.id}/content/${item.id}`}
                  className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                    {CONTENT_TYPE_LABEL[item.type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTENT_STATUS_BADGE[item.status]}`}
                  >
                    {CONTENT_STATUS_LABEL[item.status]}
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.assignee_name && <span>{item.assignee_name}</span>}
                    {item.task_total > 0 && (
                      <span>
                        {item.task_open} açık / {item.task_total} görev
                      </span>
                    )}
                    {item.target_date && (
                      <span className="tabular-nums">
                        Hedef {formatDateShort(item.target_date)}
                      </span>
                    )}
                  </span>
                </Link>
                <ArchiveContentButton contentId={item.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archivedItems.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Arşivlenenler ({archivedItems.length})
          </h2>
          <ul className="grid gap-2">
            {archivedItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-black/10 bg-white/60 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 dark:border-white/10 dark:bg-zinc-900/60"
              >
                <Link
                  href={`/brands/${brand.id}/content/${item.id}`}
                  className="flex-1"
                >
                  {item.title}
                </Link>
                <ArchiveContentButton contentId={item.id} archived />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Marka hareketleri
        </h2>
        <div className="rounded-xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
          <ActivityFeed
            entries={activity}
            emptyText="Bu markada henüz kayıtlı hareket yok."
          />
        </div>
      </section>
    </div>
  );
}
