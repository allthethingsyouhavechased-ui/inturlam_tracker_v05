import Link from "next/link";
import ActiveWorkBoard from "@/components/ActiveWorkBoard";
import AutoRefresh from "@/components/AutoRefresh";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { listActiveWorkSelections } from "@/lib/repositories/activeWork";
import { listBrands } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";
import { listAllTasks } from "@/lib/repositories/tasks";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const currentPerson = await requirePageSession();
  const people = listActivePeople();
  const brands = listBrands();
  const selections = listActiveWorkSelections();
  const tasks = listAllTasks();
  const canManageAccounts = currentPerson.is_manager === 1;

  return (
    <div className="team-page-wide">
      <AutoRefresh />
      <PageHeader
        eyebrow="ORGANİZASYON"
        title="Ekip"
        description="Kim ne üzerinde çalışıyor, ekip kapasitesi nasıl dağılıyor ve kimin desteğe ihtiyacı var?"
        actions={
          canManageAccounts ? (
            <Link
              href="/team/manage"
              className="ui-press inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-border-default bg-surface px-3 text-sm font-semibold text-secondary hover:bg-surface-hover hover:text-foreground"
            >
              <Icon name="settings" className="size-4" />
              Hesap yönetimi
            </Link>
          ) : undefined
        }
      />

      <ActiveWorkBoard
        people={people}
        brands={brands}
        selections={selections}
        tasks={tasks}
        currentPersonId={currentPerson.id}
      />
    </div>
  );
}
