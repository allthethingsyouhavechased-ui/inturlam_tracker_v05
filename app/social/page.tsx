import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/identity";

// "/social" artık üç alt sayfaya bölündü (Takip/Varlık/Paylaşım Takvimi,
// bkz. app/social/layout.tsx). Eski yer imleri/linkler kırılmasın diye
// varsayılan olarak Takip'e yönlendirir (app/dashboard/page.tsx ile aynı desen).
export default async function SocialRedirect() {
  await requirePageSession();
  redirect("/social/takip");
}
