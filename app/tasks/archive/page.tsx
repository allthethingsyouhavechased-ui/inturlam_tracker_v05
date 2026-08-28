import Link from "next/link";
import TaskArchiveExplorer from "@/components/TaskArchiveExplorer";
import Icon from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";
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
    <div>
      <PageHeader
        eyebrow="GÖREV GEÇMİŞİ"
        title="Görev arşivi"
        description="Panodan çekilen işleri marka, kişi, zorluk, revize geçmişi ve arşiv ayına göre bul. Kayıtlar silinmez; tek tıkla aktif görevlere dönebilir."
        breadcrumb={[{ label: "Görevler", href: "/tasks" }, { label: "Arşiv" }]}
        actions={
          <Link href="/tasks" className={buttonClass({ variant: "secondary" })}>
            <Icon name="arrow-right" className="size-4 rotate-180" />
            Aktif görevlere dön
          </Link>
        }
      />
      <TaskArchiveExplorer tasks={tasks} brands={brands} people={people} />
    </div>
  );
}
