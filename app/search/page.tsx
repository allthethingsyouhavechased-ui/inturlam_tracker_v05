import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { requirePageSession } from "@/lib/identity";
import {
  CONTENT_TYPE_LABEL,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABEL,
  UNKNOWN_CLUSTER_LABEL,
} from "@/lib/constants";
import { IDEA_CATEGORY_LABEL, IDEA_STATUS_LABEL } from "@/lib/ideas";
import { clusterLabelMap } from "@/lib/repositories/clusters";
import { searchAll } from "@/lib/repositories/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageSession();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? searchAll(query) : { brands: [], content: [], tasks: [], ideas: [] };
  const totalCount = results.brands.length + results.content.length + results.tasks.length + results.ideas.length;
  const clusterLabels = clusterLabelMap();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {query ? `"${query}" için arama sonuçları` : "Arama"}
      </h1>

      {!query && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Yukarıdaki arama kutusuna marka, içerik, görev veya fikir yaz.
        </p>
      )}

      {query && totalCount === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Eşleşen bir sonuç bulunamadı.</p>
      )}

      {results.brands.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Markalar ({results.brands.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {results.brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.id}`}
                className="flex items-center gap-2.5 rounded-xl border border-black/10 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
              >
                <BrandLogo name={brand.name} logoPath={brand.logo_path} size="sm" />
                <span>
                  <span className="font-medium">{brand.name}</span>
                  <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {clusterLabels[brand.cluster] ?? UNKNOWN_CLUSTER_LABEL}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.content.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            İçerikler ({results.content.length})
          </h2>
          <ul className="grid gap-2">
            {results.content.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/brands/${item.brand_id}/content/${item.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.brand_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.tasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Görevler ({results.tasks.length})
          </h2>
          <ul className="grid gap-2">
            {results.tasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
                >
                  <span className="font-medium">{task.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_BADGE[task.status]}`}
                  >
                    {TASK_STATUS_LABEL[task.status]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_PRIORITY_BADGE[task.priority]}`}
                  >
                    {TASK_PRIORITY_LABEL[task.priority]}
                  </span>
                  <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                    {task.brand_name} · {CONTENT_TYPE_LABEL[task.content_type]} · {task.content_title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.ideas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Fikirler ({results.ideas.length})
          </h2>
          <ul className="grid gap-2">
            {results.ideas.map((idea) => (
              <li key={idea.id}>
                <Link
                  href={`/ideas/${idea.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/30"
                >
                  <span className="font-medium">{idea.title}</span>
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-secondary">{IDEA_CATEGORY_LABEL[idea.category]}</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">{IDEA_STATUS_LABEL[idea.status]}</span>
                  <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">{idea.scope_type === "office" ? "Ofis geneli" : (idea.brand_name ?? "Eski marka")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
