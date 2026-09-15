// Aylık görev otomasyonunun sunucu turu.
//
// Görev Zamanlayıcı bunu GÜNDE BİR kez çağırır (sosyal ve takvim senkronuyla
// aynı desen). Gerçek zamanlayıcı YALNIZCA canlıda ve TEK sahiplikle
// etkinleştirilmelidir: yerel bir kopya aynı anda çalışırsa aynı ayı ikinci
// kez üretmeye çalışır. Üretim yine de güvenlidir — plan + ay kimliği
// benzersizdir ve ikinci deneme paket açamaz — ama gereksiz hata kaydı yazar.
//
// Çalıştırma: npm run plans:run  (alias hook'u gerekiyor, `@/...` importları var)

import { runMonthlyPlans } from "@/lib/repositories/monthlyPlans";
import { istanbulDay } from "@/lib/points/period";

const ACTOR = process.env.INTURLAM_AUTOMATION_ACTOR ?? "system";
const today = process.argv[2] ?? istanbulDay(new Date().toISOString());

if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`Geçersiz tarih: ${today}. Biçim YYYY-AA-GG olmalı.`);
  process.exit(1);
}

const outcomes = runMonthlyPlans({ today, actorId: ACTOR });
const created = outcomes.filter((outcome) => outcome.status === "ok");
const failed = outcomes.filter((outcome) => outcome.status === "error");

console.log(`[${today}] ${created.length} paket üretildi, ${failed.length} plan hata verdi.`);
for (const outcome of failed) {
  console.error(`  plan ${outcome.planId} (${outcome.planMonth}): ${outcome.message}`);
}
// Hata çıkışı VERMİYORUZ: tek bir planın pasif sorumlusu yüzünden zamanlayıcı
// "başarısız" işaretlenip kalan planların üretimi gözden kaçmasın. Hatalar
// plan ekranında ve bu çıktıda görünür.
process.exit(0);
