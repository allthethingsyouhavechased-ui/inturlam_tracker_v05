import assert from "node:assert/strict";
import { IDENTITY_COOKIE } from "@/lib/auth/constants";
import { todayISO } from "@/lib/date";
import { getDb } from "@/lib/db/client";
import {
  createAuthSession,
  deleteAuthSession,
} from "@/lib/repositories/authSessions";

// Bu script CALISAN bir sunucuya HTTP atar; hicbir sey derlemez.
// Varsayilan port 3000 — v03 gecis doneminde bir sure 3001'di, sunucu 3000'e
// alindiktan sonra bu varsayilan guncellenmedigi icin script "fetch failed" verip
// aylarca calistirilmadi. Calistirilmayinca da asagidaki metin kontrolleri
// arayuz yeniden adlandirmalariyla sessizce bayatladi (2026-08-31'de topluca
// guncellendi). Arayuzde bir bolumu YENIDEN ADLANDIRIRKEN buraya da bak.
const baseUrl = process.env.INTURLAM_SMOKE_URL ?? "http://127.0.0.1:3000";
const db = getDb();
const person = db
  .prepare("SELECT id FROM people WHERE active = 1 ORDER BY is_manager DESC, id LIMIT 1")
  .get() as { id: string } | undefined;
const brand = db
  .prepare("SELECT id FROM brands WHERE archived = 0 ORDER BY sort_order, id LIMIT 1")
  .get() as { id: string } | undefined;

assert.ok(person, "Smoke testi için aktif ekip hesabı bulunamadı.");
assert.ok(brand, "Smoke testi için aktif marka bulunamadı.");

const token = createAuthSession(person.id);
const headers = { Cookie: `${IDENTITY_COOKIE}=${token}` };
const today = todayISO();
const month = today.slice(0, 7);
const todayDay = Number(today.slice(-2));
const selectedDate = `${month}-${String(todayDay === 1 ? 2 : 1).padStart(2, "0")}`;
const encodedTodayHref = `href="/calendar?month=${month}&amp;day=${today}"`;

function occurrenceCount(value: string, fragment: string): number {
  return value.split(fragment).length - 1;
}

try {
  const [currentResponse, selectedResponse, brandResponse, brandEventReportsResponse, homeResponse, panomResponse, contributionResponse, assignedBrandsResponse, tasksResponse, reportsResponse] = await Promise.all([
    fetch(`${baseUrl}/calendar?month=${month}`, { headers }),
    fetch(`${baseUrl}/calendar?month=${month}&day=${selectedDate}`, { headers }),
    fetch(`${baseUrl}/brands/${brand.id}`, { headers }),
    fetch(`${baseUrl}/brands/${brand.id}/reports?month=${month}`, { headers }),
    fetch(`${baseUrl}/`, { headers }),
    fetch(`${baseUrl}/panom`, { headers }),
    fetch(`${baseUrl}/panom/katkim`, { headers }),
    fetch(`${baseUrl}/panom/markalar`, { headers }),
    fetch(`${baseUrl}/tasks`, { headers }),
    fetch(`${baseUrl}/reports`, { headers }),
  ]);

  assert.equal(currentResponse.status, 200, "Güncel ay takvimi açılamadı.");
  assert.equal(selectedResponse.status, 200, "Seçili gün takvimi açılamadı.");
  assert.equal(brandResponse.status, 200, "Marka sayfası açılamadı.");
  assert.equal(brandEventReportsResponse.status, 200, "Marka etkinlik raporları açılamadı.");
  assert.equal(homeResponse.status, 200, "Bugün sayfası açılamadı.");
  assert.equal(panomResponse.status, 200, "Panom açılamadı.");
  assert.equal(contributionResponse.status, 200, "Katkı detay sayfası açılamadı.");
  assert.equal(assignedBrandsResponse.status, 200, "Üzerimdeki markalar detay sayfası açılamadı.");
  assert.equal(tasksResponse.status, 200, "Görevler sayfası açılamadı.");
  assert.equal(reportsResponse.status, 200, "Raporlar sayfası açılamadı.");

  const [currentHtml, selectedHtml, brandHtml, brandEventReportsHtml, homeHtml, panomHtml, contributionHtml, assignedBrandsHtml, tasksHtml, reportsHtml] = await Promise.all([
    currentResponse.text(),
    selectedResponse.text(),
    brandResponse.text(),
    brandEventReportsResponse.text(),
    homeResponse.text(),
    panomResponse.text(),
    contributionResponse.text(),
    assignedBrandsResponse.text(),
    tasksResponse.text(),
    reportsResponse.text(),
  ]);

  const currentTodayLinks = occurrenceCount(currentHtml, encodedTodayHref);
  const selectedTodayLinks = occurrenceCount(selectedHtml, encodedTodayHref);
  assert.ok(selectedTodayLinks > currentTodayLinks, "Bugün kısayolu yalnızca başka gün seçildiğinde eklenmeli.");
  // Etkinlik penceresinin İÇİ (başlangıç/bitiş alanları, renk seçici) burada
  // aranmaz: pencere `open && isClient && createPortal(...)` ile yalnızca
  // istemcide çizildiği için sunucudan çekilen HTML'de hiçbir zaman bulunmaz.
  // Varsayılan saat aralığı kuralı tests/calendarNewEventRange.test.ts'te.
  assert.ok(currentHtml.includes("Yeni etkinlik"), "Takvim yeni etkinlik açma düğmesini göstermeli.");
  // "Yıllık" etiketi sayfada bu yazımla basılıyor; kontrol uzun süre "YILLIK"
  // (büyük harf) arıyordu ve o dize marka sayfasında hiç var olmadı.
  assert.ok(brandHtml.includes("ÇEKİM HAKLARI") && brandHtml.includes("Yıllık"), "Marka sayfası yıllık çekim hakkını göstermeli.");
  assert.ok(brandHtml.includes("Etkinlik raporları"), "Marka sayfası etkinlik raporlarına bağlanmalı.");
  assert.ok(brandEventReportsHtml.includes("Toplantı ve çekim raporları"), "Marka etkinlik raporu çalışma alanını göstermeli.");
  assert.ok(homeHtml.includes("AYLIK ÜRETİM AKIŞI") && homeHtml.includes("PORTFÖY İLERLEMESİ"), "Bugün sayfası portföy ilerlemesini ve üretim akışını göstermeli.");
  assert.ok(panomHtml.includes("Marka analizi") && panomHtml.includes("Katkı analizi"), "Panom kişisel araç düğmelerini göstermeli.");
  assert.ok(!panomHtml.includes("Ekipte gecikmiş / bu hafta teslim"), "Panom ekip geneli görev panelini göstermemeli.");
  assert.ok(contributionHtml.includes("Bu ayki katkım") && contributionHtml.includes("Puanı oluşturan görevler"), "Katkı detay sayfası ayrıntılı analizi göstermeli.");
  assert.ok(assignedBrandsHtml.includes("TOPLAM İLERLEME") && assignedBrandsHtml.includes("AĞIRLIKLI PUAN"), "Üzerimdeki markalar detay sayfası birleşik ilerlemeyi göstermeli.");
  const undatedTaskCount = (db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE due_date IS NULL").get() as { count: number }).count;
  if (undatedTaskCount > 0) assert.ok(tasksHtml.includes("Tarih bekleyenler"), "Görevler sayfası tarih bekleyenler düğmesini göstermeli.");
  assert.ok(reportsHtml.includes("Ekip görünümü"), "Raporlar sayfası ekip görünümü panelini göstermeli.");

  console.log(JSON.stringify({
    baseUrl,
    calendarCurrent: currentResponse.status,
    calendarSelected: selectedResponse.status,
    brand: brandResponse.status,
    brandEventReports: brandEventReportsResponse.status,
    home: homeResponse.status,
    panom: panomResponse.status,
    contribution: contributionResponse.status,
    assignedBrands: assignedBrandsResponse.status,
    tasks: tasksResponse.status,
    reports: reportsResponse.status,
    selectedDate,
  }));
} finally {
  deleteAuthSession(token);
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
}
