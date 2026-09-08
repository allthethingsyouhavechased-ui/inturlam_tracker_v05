import Link from "next/link";
import IdeaCreateButton from "@/components/IdeaCreateButton";
import IdeaBankExplorer from "@/components/IdeaBankExplorer";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import { countArchivedIdeas, listIdeas } from "@/lib/repositories/ideas";

export const dynamic = "force-dynamic";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; brand?: string; new?: string }>;
}) {
  await requirePageSession();
  const sp = await searchParams;
  const archived = sp.view === "archive";
  const brands = listBrandsAlphabetically();
  const ideas = listIdeas(archived);
  const archivedCount = countArchivedIdeas();
  const initialBrandId = brands.some((brand) => brand.id === sp.brand) ? sp.brand : "";

  return (
    <div>
      <PageHeader
        className="lg:items-center"
        eyebrow="ORTAK YARATICI HAFIZA"
        title="Fikir Bankası"
        description="Marka içeriklerinden ofis süreçlerine kadar akla gelen fikirleri ve ilham kaynaklarını kaybetmeden yakala, geliştir ve yeniden bul."
        descriptionClassName="max-w-none 2xl:whitespace-nowrap"
        actions={
          <>
            <Link
              href={archived ? "/ideas" : "/ideas?view=archive"}
              className={buttonClass({
                variant: "secondary",
                className: "border-brand-500/30 bg-brand-500/[0.06] text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 dark:text-brand-300",
              })}
            >
              <Icon name="archive" className="size-4" />
              {archived ? "Aktif fikirler" : `Arşiv · ${archivedCount}`}
            </Link>
            {!archived && <span className="hidden lg:inline-flex"><IdeaCreateButton /></span>}
          </>
        }
      />
      <IdeaBankExplorer
        key={`${archived ? "archive" : "active"}:${initialBrandId}:${sp.new === "1" ? "new" : "closed"}`}
        ideas={ideas}
        brands={brands}
        archived={archived}
        initialBrandId={initialBrandId}
        newOpen={sp.new === "1"}
      />
    </div>
  );
}
