import { isRequestReviewer } from "@/lib/repositories/requestReviewers";
import type { Person } from "@/lib/types";

// Talep değerlendirme yetkisi artık SABİT kişi listesi değil, yönetilebilir bir
// tablo (`client_request_reviewers`). Eski beş kişinin hakkı migration 030 ile
// olduğu gibi taşındı; yönetici arayüzden ekleyip çıkarabiliyor.
//
// Yöneticiler tabloya yazılmadan da değerlendirebilir: yetkiyi VEREN rol,
// kendi göremediği bir kuyruğa yetki dağıtamaz.
export function canReviewClientRequests(
  person:
    | (Pick<Person, "id"> & Partial<Pick<Person, "department" | "is_manager">>)
    | null
    | undefined,
): boolean {
  if (!person) return false;
  if (person.is_manager === 1) return true;
  return isRequestReviewer(person.id);
}
