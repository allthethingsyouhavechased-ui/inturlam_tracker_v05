import Link from "next/link";
import TaskArchiveExplorer from "@/components/TaskArchiveExplorer";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";
import { listArchivedTasks, sweepArchivablePublishedTasks } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

export default async function TaskArchivePage() {
  await requirePageSession();
  sweepArchivablePublishedTasks();
  const tasks = listArchivedTasks();
  const brands = listBrands();
  const people = listActivePeople();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="GÖREV GEÇMİŞİ"
        title="Görev arşivi"
        description="Panodan çekilen işleri marka, kişi, zorluk, revize geçmişi ve arşiv ayına göre bul. Kayıtlar silinmez; tek tıkla aktif görevlere dönebilir."
        breadcrumb={[{ label: "Görevler", href: "/tasks" }, { label: "Arşiv" }]}
        actions={
          <Link href="/tasks" className="ui-press inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover">
            <Icon name="arrow-right" className="size-4 rotate-180" />
            Aktif görevlere dön
          </Link>
        }
      />
      <TaskArchiveExplorer tasks={tasks} brands={brands} people={people} />
    </div>
  );
}
