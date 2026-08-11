import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requirePageSession();
  redirect("/tasks");
}
