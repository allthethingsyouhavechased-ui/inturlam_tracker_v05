import Link from "next/link";
import ActiveWorkBoard from "@/components/ActiveWorkBoard";
import AutoRefresh from "@/components/AutoRefresh";
import Icon from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { todayISO } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import {
  listActiveWorkSelections,
  listPersonTaskPreviews,
  listPersonTaskWorkSummaries,
} from "@/lib/repositories/activeWork";
import { listBrands } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const currentPerson = await requirePageSession();
  const people = listActivePeople();
  const brands = listBrands();
  const selections = listActiveWorkSelections();
  const taskSummaries = listPersonTaskWorkSummaries(todayISO());
  const taskPreviews = listPersonTaskPreviews();
  const canManageAccounts = currentPerson.is_manager === 1;

  return (
    <div className="w-full">
      <AutoRefresh />
      <PageHeader
        eyebrow="ORGANİZASYON"
        title="Ekip"
        description="Kim ne üzerinde çalışıyor, ekip kapasitesi nasıl dağılıyor ve kimin desteğe ihtiyacı var?"
        actions={
          canManageAccounts ? (
            <Link
              href="/team/manage"
              className={buttonClass({ variant: "secondary" })}
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
        taskSummaries={taskSummaries}
        taskPreviews={taskPreviews}
        currentPersonId={currentPerson.id}
      />
    </div>
  );
}
