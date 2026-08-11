import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/identity";

export default async function SettingsPage() {
  await requirePageSession();
  redirect("/settings/profile");
}
