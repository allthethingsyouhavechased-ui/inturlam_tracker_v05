import ActivitySearch from "@/components/ActivitySearch";
import AutoRefresh from "@/components/AutoRefresh";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { listRecentActivity } from "@/lib/repositories/activity";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requirePageSession();
  const entries = listRecentActivity(150);

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        eyebrow="DENETİM İZİ"
        title="Aktivite"
        description="Portföydeki son 150 değişikliği kişi, görev ve işlem bazında ara."
      />

      <ActivitySearch entries={entries} />
    </div>
  );
}
