import { redirect } from "next/navigation";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function MonthlyPointTargetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePageSession();
  const month = monthParamISO(monthParamToDate((await searchParams).month));
  redirect(`/team/targets?month=${month}&manage=1`);
}
