import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/identity";

// Panom artık "/panom"da yaşıyor. Eski /dashboard linkleri kırılmasın diye
// buradan yönlendiriyoruz.
export default async function DashboardRedirect() {
  await requirePageSession();
  redirect("/panom");
}
