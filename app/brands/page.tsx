import Link from "next/link";
import ArchiveBrandButton from "@/components/ArchiveBrandButton";
import BrandLogo from "@/components/BrandLogo";
import ClusterManager from "@/components/ClusterManager";
import DeleteBrandButton from "@/components/DeleteBrandButton";
import NewBrandForm from "@/components/NewBrandForm";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { instagramProfileUrl, normalizeInstagramHandle } from "@/lib/instagram";
import { listArchivedBrands, listBrandsWithOpenCounts } from "@/lib/repositories/brands";
import { groupBrandsByCluster, listClusters } from "@/lib/repositories/clusters";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  await requirePageSession();
  const brands = listBrandsWithOpenCounts();
  const archived = listArchivedBrands();
  const clusters = listClusters();
  const groups = groupBrandsByCluster(brands, clusters);

  const brandCountByCluster = new Map<string, number>();
  for (const brand of [...brands, ...archived]) {
    brandCountByCluster.set(
      brand.cluster,
      (brandCountByCluster.get(brand.cluster) ?? 0) + 1,
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="PORTFÖY"
        title="Markalar"
        description={`${brands.length} aktif markanın çalışma alanları, açık iş yükleri ve içerik akışları.`}
        actions={
          <div className="relative flex w-full max-w-[calc(100vw-2rem)] flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:max-w-none sm:flex-wrap sm:overflow-visible sm:pb-0">
            <ClusterManager
              clusters={clusters.map((cluster) => ({
                id: cluster.id,
                label: cluster.label,
                brandCount: brandCountByCluster.get(cluster.id) ?? 0,
              }))}
            />
            <details open={brands.length === 0} className="group relative">
              <summary className="ui-press flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[10px] bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-500 [&::-webkit-details-marker]:hidden">
                <Icon name="plus" className="size-4" />
                Yeni marka
                <Icon name="chevron-down" className="size-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="ui-enter absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(60rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-surface p-4 shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-foreground">Yeni marka oluştur</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Temel bilgileri ve logoyu ekleyerek markayı çalışma alanına dahil et.
                  </p>
                </div>
                <NewBrandForm clusters={clusters} />
              </div>
            </details>
          </div>
        }
      />

      <div className="space-y-7">
        {groups.map((group) => {
          if (group.items.length === 0) return null;
          return (
            <section key={group.id} aria-labelledby={`brand-group-${group.id}`}>
              <h2
                id={`brand-group-${group.id}`}
                className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted"
              >
                {group.label.toLocaleUpperCase("tr-TR")}
              </h2>

              <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface">
                {group.items.map((brand) => {
                  const instagramHandle = normalizeInstagramHandle(brand.instagram_handle);
                  const instagramUrl = instagramProfileUrl(brand.instagram_handle);
                  return (
                  <div
                    key={brand.id}
                    className="group relative flex min-h-[72px] min-w-0 items-center gap-3 bg-surface px-3 py-2.5 transition-colors hover:bg-surface-hover sm:px-4"
                  >
                    <Link
                      href={`/brands/${brand.id}`}
                      aria-label={`${brand.name} çalışma alanına git`}
                      className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
                    ><span className="sr-only">{brand.name} çalışma alanına git</span></Link>
                    <div className="pointer-events-none relative z-[1] grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:grid-cols-[minmax(15rem,1.15fr)_minmax(8rem,0.55fr)_minmax(10rem,0.75fr)_minmax(12rem,1fr)]">
                      <span className="flex min-w-0 items-center gap-3">
                      <BrandLogo name={brand.name} logoPath={brand.logo_path} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">
                          {brand.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {brand.tier ? `Tier ${brand.tier}` : "Marka çalışma alanı"}
                        </span>
                      </span>
                      </span>

                      <span className="text-right lg:text-left">
                        <span className="block text-[9px] font-semibold tracking-[0.08em] text-faint">AKTİF İŞ</span>
                        <span className={`mt-1 block text-xs font-semibold tabular-nums ${brand.open_count > 0 ? "text-foreground" : "text-muted"}`}>
                          {brand.open_count > 0 ? `${brand.open_count} açık görev` : "İş yükü yok"}
                        </span>
                      </span>

                      <span className="hidden min-w-0 lg:block">
                        <span className="block text-[9px] font-semibold tracking-[0.08em] text-faint">SOSYAL HESAP</span>
                        {instagramUrl && instagramHandle ? (
                          <a
                            href={instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${brand.name} Instagram hesabını aç`}
                            className="pointer-events-auto relative z-10 mt-0.5 inline-flex min-h-8 max-w-full items-center truncate rounded-md text-xs font-medium text-secondary underline decoration-border-strong underline-offset-4 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:text-brand-300"
                          >
                            @{instagramHandle}
                          </a>
                        ) : (
                          <span className="mt-1 block truncate text-xs font-medium text-muted">Kullanıcı adı girilmemiş</span>
                        )}
                      </span>

                      <span className="hidden min-w-0 lg:block">
                        <span className="block text-[9px] font-semibold tracking-[0.08em] text-faint">KISA BİLGİ</span>
                        <span className="mt-1 block truncate text-xs text-secondary" title={brand.key_finding ?? undefined}>
                          {brand.key_finding
                            ? brand.key_finding.split("\n")[0]
                            : brand.follower_count != null
                              ? `${brand.follower_count.toLocaleString("tr-TR")} takipçi · ${(brand.post_count ?? 0).toLocaleString("tr-TR")} gönderi`
                              : "Marka notu henüz eklenmemiş"}
                        </span>
                      </span>
                    </div>
                    <span className="relative z-10 flex shrink-0 items-center gap-1.5">
                      <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <ArchiveBrandButton brandId={brand.id} />
                      </span>
                      <Link
                        href={`/brands/${brand.id}`}
                        aria-label={`${brand.name} çalışma alanına git`}
                        className="ui-press grid size-9 place-items-center rounded-[9px] text-faint hover:bg-surface-hover hover:text-secondary"
                      >
                        <Icon name="chevron-right" className="size-4" />
                      </Link>
                    </span>
                  </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {brands.length === 0 && (
          <section className="rounded-xl border border-dashed border-border-default bg-surface-subtle px-5 py-10 text-center">
            <h2 className="text-sm font-semibold text-foreground">Henüz aktif marka yok</h2>
            <p className="mt-1 text-xs text-muted">İlk çalışma alanını oluşturmak için “Yeni marka”yı kullan.</p>
          </section>
        )}

        {archived.length > 0 && (
          <section aria-labelledby="archived-brands-title">
            <h2 id="archived-brands-title" className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted">
              ARŞİVLENENLER · {archived.length}
            </h2>
            <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-dashed border-border-default bg-surface-subtle">
              {archived.map((brand) => (
                <div key={brand.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <BrandLogo name={brand.name} logoPath={brand.logo_path} size="sm" />
                    <span className="truncate text-sm text-secondary">{brand.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <ArchiveBrandButton brandId={brand.id} archived />
                    <DeleteBrandButton brandId={brand.id} />
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
