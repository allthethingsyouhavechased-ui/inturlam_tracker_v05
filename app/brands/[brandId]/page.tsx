import Link from "next/link";
import { notFound } from "next/navigation";
import ActivityFeed from "@/components/ActivityFeed";
import ArchiveContentButton from "@/components/ArchiveContentButton";
import AutoRefresh from "@/components/AutoRefresh";
import BrandContentTargetsSection from "@/components/BrandContentTargetsSection";
import BrandLogo from "@/components/BrandLogo";
import BrandOperationsOverview, { BrandOperationLinks } from "@/components/BrandOperationsOverview";
import BrandWorkspaceSummary from "@/components/BrandWorkspaceSummary";
import EditBrandForm from "@/components/EditBrandForm";
import EmptyState from "@/components/EmptyState";
import NewContentForm from "@/components/NewContentForm";
import PersonAvatar from "@/components/PersonAvatar";
import QuickAddModal from "@/components/QuickAddModal";
import SocialHealthBadge from "@/components/SocialHealthBadge";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import {
  CONTENT_STATUS_BADGE,
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABEL,
  UNKNOWN_CLUSTER_LABEL,
} from "@/lib/constants";
import { formatDateShort, formatIsoDateTime, monthParamISO, monthParamToDate, shiftMonthParam, todayISO } from "@/lib/date";
import { SOCIAL_SILENCE_DAYS } from "@/lib/social";
import { listBrandSocialRows } from "@/lib/repositories/social";
import { classifySocial } from "@/lib/socialSilence";
import { requirePageSession } from "@/lib/identity";
import { instagramProfileUrl, normalizeInstagramHandle } from "@/lib/instagram";
import { getBrand } from "@/lib/repositories/brands";
import { countIdeasForBrand } from "@/lib/repositories/ideas";
import { listActivityForBrand } from "@/lib/repositories/activity";
import { clusterLabelMap, listClusters } from "@/lib/repositories/clusters";
import { listArchivedContentByBrand, listContentByBrand } from "@/lib/repositories/content";
import { listActivePeople } from "@/lib/repositories/people";
import { listBrandPersonAssignments } from "@/lib/repositories/brandAssignments";
import { listCalendarEvents } from "@/lib/repositories/calendarEvents";
import { getBrandMonthlyProgress, listBrandMonthlyContributions } from "@/lib/repositories/progress";
import { getBrandMonthlyContentCompletion, listContentTargetsForBrand } from "@/lib/repositories/socialPlan";
import { listTemplates } from "@/lib/repositories/templates";
import { listOpenTasksByBrand } from "@/lib/repositories/tasks";
import { emptyKindRecord } from "@/lib/socialPlan";
import type { ContentKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const BRAND_SECONDARY_CONTROL =
  "border-brand-500/30 bg-brand-500/[0.06] text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200";

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await requirePageSession();
  const canManageBrand = me.is_manager === 1;
  const [{ brandId }, sp] = await Promise.all([params, searchParams]);
  const brand = getBrand(brandId);
  if (!brand) notFound();
  const brandIdeaCount = countIdeasForBrand(brandId);

  const items = listContentByBrand(brandId);
  const openTasks = listOpenTasksByBrand(brandId, 5);
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
  const month = monthParamISO(monthParamToDate(sp.month));
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
  // Instagram kullanıcı adı girilmemiş markalar takip listesinde yok; o zaman
  // rozet de çizilmez (yanlışlıkla "taranmadı" demek yerine hiç bahsetmemek).
  const socialRow = listBrandSocialRows().find((row) => row.brand_id === brandId) ?? null;
  const socialHealth = socialRow
    ? classifySocial(socialRow, SOCIAL_SILENCE_DAYS, today)
    : null;
  const instagramHandle = normalizeInstagramHandle(brand.instagram_handle);
  const instagramUrl = instagramProfileUrl(brand.instagram_handle);

  const workspaceSummary = (
    <BrandWorkspaceSummary
      action={
        canManageBrand ? (
          <EditBrandForm
            brand={brand}
            clusters={clusters}
            people={people}
            assignments={assignments}
            triggerClassName={buttonClass({ variant: "secondary", size: "sm", className: BRAND_SECONDARY_CONTROL })}
          />
        ) : null
      }
      responsibles={
        <div
          aria-label="Marka sorumluları"
          className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5"
        >
          {assignments.length > 0 ? assignments.map((assignment) => (
            <Link
              key={assignment.person_id}
              href={`/team/${assignment.person_id}`}
              className="flex min-w-0 items-center gap-1.5 rounded-md hover:text-brand-600 dark:hover:text-brand-300"
            >
              <PersonAvatar name={assignment.person_name} avatarPath={assignment.person_avatar_path} size="xs" />
              <span className="min-w-0 truncate text-xs font-semibold text-foreground">{assignment.person_name}</span>
            </Link>
          )) : <p className="text-xs text-muted">Henüz sorumlu atanmadı.</p>}
        </div>
      }
      overview={
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
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
        </div>
      }
      activityBadge={
        socialHealth ? (
          <SocialHealthBadge
            health={socialHealth}
            detail={socialRow?.days_silent != null ? `${socialRow.days_silent} gün` : undefined}
          />
        ) : null
      }
      activity={
        <div className="mt-1.5 min-w-0">
          <span className="block truncate text-xs text-muted">
            {socialHealth
              ? socialRow?.last_post_at
                ? `Son paylaşım ${formatIsoDateTime(socialRow.last_post_at)}`
                : "Paylaşım kaydı yok"
              : "Takip hesabı bağlanmamış"}
          </span>
        </div>
      }
      shoots={
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="shrink-0 text-xs text-muted">
            Aylık{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {monthlyEvents.filter((event) => event.type === "Cekim").length}
              {brand.monthly_shoot_allowance !== null && <span className="font-medium text-muted"> / {brand.monthly_shoot_allowance}</span>}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted">
            Yıllık{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {annualEvents.filter((event) => event.type === "Cekim").length}
              {brand.annual_shoot_allowance !== null && <span className="font-medium text-muted"> / {brand.annual_shoot_allowance}</span>}
            </span>
          </span>
        </div>
      }
    />
  );

  // Markanın TÜM giriş noktaları tek sırada: fikir bankası, takvim kısayolları,
  // etkinlik raporu ve asıl eylem olan "Görev oluştur" en sağda. Takvim/rapor
  // bağlantıları daha önce sayfanın ortasındaki ayrı bir şeritteydi; aynı
  // türden düğmeleri iki farklı yükseklikte aramak gerekiyordu.
  const headerActions = (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto lg:flex-nowrap">
      <Link href={`/ideas?brand=${encodeURIComponent(brand.id)}#fikir-akisi`} className={buttonClass({ variant: "secondary", size: "sm", className: BRAND_SECONDARY_CONTROL })}>
        <Icon name="ideas" className="size-3.5" /> Fikirler · {brandIdeaCount}
      </Link>
      <BrandOperationLinks brand={brand} month={month} />
      <QuickAddModal
        options={{
          brands: [{ id: brand.id, name: brand.name }],
          contents: items.map((item) => ({ id: item.id, brand_id: brand.id, title: item.title, type: item.type })),
          people,
        }}
        defaultAssigneeId={me.id}
        canSetWeight={me.is_manager === 1}
        defaultBrandId={brand.id}
        triggerLabel="Görev oluştur"
        triggerClassName={buttonClass({ size: "sm" })}
      />
    </div>
  );

  return (
    <div>
      <AutoRefresh />
      {/* `layout="brand"`: logo + breadcrumb + eyebrow tek sütun, başlık ve
          künye onun SAĞINDA, düğmeler en sağda — hepsi tek satırda. Başlık
          bloğu alt alta dizilince sağdaki düğme sırasının altında koca bir
          boşluk kalıyordu. */}
      <PageHeader
        layout="brand"
        eyebrow="MARKA ÇALIŞMA ALANI"
        title={
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span>{brand.name}</span>
            <span className="text-[13px] font-medium leading-5 text-muted">
              {clusterLabels[brand.cluster] ?? UNKNOWN_CLUSTER_LABEL}
              {instagramUrl && instagramHandle && (
                <>
                  <span aria-hidden="true"> · </span>
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
              {brand.tier && <><span aria-hidden="true"> · </span>Tier {brand.tier}</>}
            </span>
          </span>
        }
        breadcrumb={[{ label: "Markalar", href: "/brands" }, { label: brand.name }]}
        media={<BrandLogo name={brand.name} logoPath={brand.logo_path} accentHue={brand.accent_hue} size="lg" />}
        actions={headerActions}
      />

      {workspaceSummary}

      <div className="space-y-4">
      <BrandOperationsOverview
        brand={brand}
        month={month}
        progress={progress}
        contributions={contributions}
        monthlyContents={monthlyContents}
        periodEvents={monthlyEvents}
        targets={
          <BrandContentTargetsSection
            brandId={brand.id}
            brandName={brand.name}
            targets={contentTargets}
            month={month}
            monthlyContentCompleted={Boolean(monthlyContentCompletion)}
            compact
          />
        }
      />

      <section className="space-y-3" aria-labelledby="open-brand-tasks">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="open-brand-tasks" className="text-h2 text-foreground">Açık görevler</h2>
            <p className="mt-0.5 text-xs text-muted">Önceliği ve teslim tarihi en yakın işler.</p>
          </div>
          <Link
            href={`/tasks?brand=${encodeURIComponent(brand.id)}&focus=open`}
            className={buttonClass({ variant: "secondary", size: "sm", className: BRAND_SECONDARY_CONTROL })}
          >
            Tüm görevleri aç
            <Icon name="arrow-right" className="size-3.5" />
          </Link>
        </div>

        {openTasks.length === 0 ? (
          <EmptyState
            compact
            title="Bu markada açık görev yok"
            description="Yeni görev oluşturulduğunda en yakın işler burada görünecek."
          />
        ) : (
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface">
            {openTasks.map((task) => (
              <li
                key={task.id}
                className="px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="line-clamp-2 font-display text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-300"
                    >
                      {task.title}
                    </Link>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {brand.name} · {task.content_title}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${TASK_STATUS_BADGE[task.status]}`}>
                    {TASK_STATUS_LABEL[task.status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2 text-xs text-secondary">
                  <span className={`rounded-md px-2 py-1 font-semibold ${TASK_PRIORITY_BADGE[task.priority]}`}>
                    {TASK_PRIORITY_LABEL[task.priority]}
                  </span>
                  <span className="rounded-md bg-surface-muted px-2 py-1 font-semibold tabular-nums">
                    {task.weight_points} puan
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5">
                    {task.assignee_name ?? "Atanmamış"}
                    <span aria-hidden="true">·</span>
                    {task.due_date ? formatDateShort(task.due_date) : "Tarih yok"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Projeler ve içerikler ({items.length})
          </h2>
          <details className="group relative">
            <summary className="ui-press flex min-h-9 cursor-pointer list-none items-center rounded-[9px] border border-brand-500/30 bg-brand-500/[0.06] px-3 text-xs font-semibold text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 dark:text-brand-300 [&::-webkit-details-marker]:hidden">
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
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <Link
                  href={`/brands/${brand.id}/content/${item.id}`}
                  className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="font-display text-xs font-medium text-muted">{brand.name}</span>
                  <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-secondary">
                    {CONTENT_TYPE_LABEL[item.type]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTENT_STATUS_BADGE[item.status]}`}
                  >
                    {CONTENT_STATUS_LABEL[item.status]}
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-xs text-muted">
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
          <h2 className="text-eyebrow text-muted">
            Arşivlenenler ({archivedItems.length})
          </h2>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-dashed border-border-default bg-surface-subtle">
            {archivedItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm text-muted"
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
        <h2 className="text-eyebrow text-muted">
          Marka hareketleri
        </h2>
        <div className="rounded-xl border border-border-default bg-surface p-2">
          <ActivityFeed
            entries={activity}
            emptyText="Bu markada henüz kayıtlı hareket yok."
          />
        </div>
      </section>
      </div>
    </div>
  );
}
