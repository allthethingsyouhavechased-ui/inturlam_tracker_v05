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
import { listAllPersonBrandAssignments } from "@/lib/repositories/brandAssignments";
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const currentPerson = await requirePageSession();
  const people = listActivePeople();
  const brands = listBrandsAlphabetically();
  const selections = listActiveWorkSelections();
  const taskSummaries = listPersonTaskWorkSummaries(todayISO());
  const taskPreviews = listPersonTaskPreviews();
  // Kalıcı marka sorumlulukları marka sayfasıyla AYNI tablodan okunuyor.
  const assignments = listAllPersonBrandAssignments();
  const canManageAccounts = currentPerson.is_manager === 1;
  // Puan ekranı rapor yetkisine bağlı; düğme yalnızca açabilecek kişiye görünür.
  const canViewPoints = currentPerson.is_manager === 1;

  return (
    <div className="w-full">
      <AutoRefresh />
      <PageHeader
        eyebrow="ORGANİZASYON"
        title="Ekip"
        description="Kim ne üzerinde çalışıyor, ekip kapasitesi nasıl dağılıyor ve kimin desteğe ihtiyacı var?"
        actions={
          <>
            <Link href="/team/targets" className={buttonClass({ variant: "secondary" })}>
              <Icon name="reports" className="size-4" />
              Aylık hedefler
            </Link>
            {/* Kazanılmış puan ekranı global menüde değil, ekibin yanında:
                aylık hedefle birlikte okunan bir ölçü. Sayfanın kendisi
                yönetici kapısını (requireReportAccess) koruyor. */}
            {canViewPoints && (
              <Link href="/reports/puan" className={buttonClass({ variant: "secondary" })}>
                <Icon name="reports" className="size-4" />
                Puanlar
              </Link>
            )}
            {canManageAccounts && (
            <Link
              href="/team/manage"
              className={buttonClass({ variant: "secondary" })}
            >
              <Icon name="settings" className="size-4" />
              Hesap yönetimi
            </Link>
            )}
          </>
        }
      />

      <ActiveWorkBoard
        people={people}
        brands={brands}
        selections={selections}
        taskSummaries={taskSummaries}
        taskPreviews={taskPreviews}
        currentPersonId={currentPerson.id}
        assignments={assignments}
        canManageAssignments={canManageAccounts}
      />
    </div>
  );
}
