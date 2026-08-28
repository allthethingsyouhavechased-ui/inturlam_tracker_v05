import ArchiveBrandButton from "@/components/ArchiveBrandButton";
import BrandLogo from "@/components/BrandLogo";
import BrandResponsibilitiesDialog from "@/components/BrandResponsibilitiesDialog";
import BrandsPortfolioTable from "@/components/BrandsPortfolioTable";
import ClusterManager from "@/components/ClusterManager";
import DeleteBrandButton from "@/components/DeleteBrandButton";
import NewBrandForm from "@/components/NewBrandForm";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { todayISO } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { instagramProfileUrl, normalizeInstagramHandle } from "@/lib/instagram";
import type { BrandPortfolioRow } from "@/lib/brandPortfolio";
import { SOCIAL_SILENCE_DAYS } from "@/lib/social";
import { classifySocial } from "@/lib/socialSilence";
import { listAllPersonBrandAssignments } from "@/lib/repositories/brandAssignments";
import { listArchivedBrands, listBrandsWithOpenCounts } from "@/lib/repositories/brands";
import { listClusters } from "@/lib/repositories/clusters";
import { listActivePeople } from "@/lib/repositories/people";
import { listBrandMonthlyProgress } from "@/lib/repositories/progress";
import { listBrandSocialRows } from "@/lib/repositories/social";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const me = await requirePageSession();
  const canManageBrands = me.is_manager === 1;
  const brands = [...listBrandsWithOpenCounts()].sort((left, right) =>
    left.name.localeCompare(right.name, "tr", { sensitivity: "base" }),
  );
  const archived = [...listArchivedBrands()].sort((left, right) =>
    left.name.localeCompare(right.name, "tr", { sensitivity: "base" }),
  );
  const clusters = listClusters();
  const people = listActivePeople();
  const assignments = listAllPersonBrandAssignments();
  const month = todayISO().slice(0, 7);
  const progressByBrand = new Map(listBrandMonthlyProgress(month).map((row) => [row.brand_id, row.progress]));
  const socialByBrand = new Map(listBrandSocialRows().map((row) => [row.brand_id, row]));
  const clusterLabel = new Map(clusters.map((cluster) => [cluster.id, cluster.label]));
  const personName = new Map(people.map((person) => [person.id, person.name]));
  const today = todayISO();

  const rows: BrandPortfolioRow[] = brands.map((brand) => {
    const progress = progressByBrand.get(brand.id);
    const social = socialByBrand.get(brand.id);
    const handle = normalizeInstagramHandle(brand.instagram_handle);
    return {
      id: brand.id,
      name: brand.name,
      logoPath: brand.logo_path,
      accentHue: brand.accent_hue,
      sortOrder: brand.sort_order,
      clusterLabel: clusterLabel.get(brand.cluster) ?? brand.cluster,
      progressPercent: progress?.percent ?? null,
      weightedEarned: progress?.weighted_earned ?? 0,
      weightedTotal: progress?.weighted_total ?? 0,
      openCount: brand.open_count,
      socialHealth: social ? classifySocial(social, SOCIAL_SILENCE_DAYS, today) : null,
      socialDetail: social?.days_silent === null || social?.days_silent === undefined ? null : `${social.days_silent} gün`,
      instagramHandle: handle,
      instagramUrl: instagramProfileUrl(brand.instagram_handle),
      responsibleNames: assignments
        .filter((assignment) => assignment.brand_id === brand.id)
        .map((assignment) => personName.get(assignment.person_id))
        .filter((name): name is string => Boolean(name)),
    };
  });

  const brandCountByCluster = new Map<string, number>();
  for (const brand of [...brands, ...archived]) {
    brandCountByCluster.set(brand.cluster, (brandCountByCluster.get(brand.cluster) ?? 0) + 1);
  }

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="PORTFÖY"
        title="Markalar"
        description={`${brands.length} aktif markanın aylık ilerlemesi, açık iş yükü, sosyal sağlığı ve sorumluları.`}
        actions={canManageBrands && (
          <div className="relative flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <ClusterManager clusters={clusters.map((cluster) => ({ id: cluster.id, label: cluster.label, brandCount: brandCountByCluster.get(cluster.id) ?? 0 }))} />
            <BrandResponsibilitiesDialog brands={brands} people={people} assignments={assignments} />
            <details open={brands.length === 0} className="group relative">
              <summary className={buttonClass({ className: "list-none [&::-webkit-details-marker]:hidden" })}>
                <Icon name="plus" className="size-4" /> Yeni marka
                <Icon name="chevron-down" className="size-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="ui-enter absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(60rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-surface p-4 shadow-lg sm:left-auto sm:right-0">
                <div className="mb-3"><p className="text-sm font-semibold text-foreground">Yeni marka oluştur</p><p className="mt-0.5 text-xs text-muted">Temel bilgileri ve logoyu ekleyerek markayı çalışma alanına dahil et.</p></div>
                <NewBrandForm clusters={clusters} />
              </div>
            </details>
          </div>
        )}
      />

      <div className="space-y-7">
      <BrandsPortfolioTable rows={rows} canManageBrands={canManageBrands} />

      {archived.length > 0 && (
        <section aria-labelledby="archived-brands-title">
          <h2 id="archived-brands-title" className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted">ARŞİVLENENLER · {archived.length}</h2>
          <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-dashed border-border-default bg-surface-subtle">
            {archived.map((brand) => (
              <div key={brand.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-3"><BrandLogo name={brand.name} logoPath={brand.logo_path} accentHue={brand.accent_hue} size="sm" /><span className="brand-name truncate text-sm text-secondary">{brand.name}</span></span>
                {canManageBrands && <span className="flex items-center gap-2"><ArchiveBrandButton brandId={brand.id} archived /><DeleteBrandButton brandId={brand.id} /></span>}
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
