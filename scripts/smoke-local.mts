import assert from "node:assert/strict";
import { IDENTITY_COOKIE } from "@/lib/auth/constants";
import { todayISO } from "@/lib/date";
import { getDb } from "@/lib/db/client";
import {
  createAuthSession,
  deleteAuthSession,
} from "@/lib/repositories/authSessions";

const baseUrl = process.env.INTURLAM_SMOKE_URL ?? "http://127.0.0.1:3001";
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
  const [currentResponse, selectedResponse, brandResponse] = await Promise.all([
    fetch(`${baseUrl}/calendar?month=${month}`, { headers }),
    fetch(`${baseUrl}/calendar?month=${month}&day=${selectedDate}`, { headers }),
    fetch(`${baseUrl}/brands/${brand.id}`, { headers }),
  ]);

  assert.equal(currentResponse.status, 200, "Güncel ay takvimi açılamadı.");
  assert.equal(selectedResponse.status, 200, "Seçili gün takvimi açılamadı.");
  assert.equal(brandResponse.status, 200, "Marka sayfası açılamadı.");

  const [currentHtml, selectedHtml, brandHtml] = await Promise.all([
    currentResponse.text(),
    selectedResponse.text(),
    brandResponse.text(),
  ]);

  const currentTodayLinks = occurrenceCount(currentHtml, encodedTodayHref);
  const selectedTodayLinks = occurrenceCount(selectedHtml, encodedTodayHref);
  assert.ok(selectedTodayLinks > currentTodayLinks, "Bugün kısayolu yalnızca başka gün seçildiğinde eklenmeli.");
  assert.ok(selectedHtml.includes(`value="${selectedDate}T09:00"`), "Seçili gün başlangıç alanına taşınmalı.");
  assert.ok(selectedHtml.includes(`value="${selectedDate}T10:00"`), "Seçili gün bitiş alanına taşınmalı.");
  assert.ok(brandHtml.includes("ÇEKİM HAKLARI") && brandHtml.includes("YILLIK"), "Marka sayfası yıllık çekim hakkını göstermeli.");

  console.log(JSON.stringify({
    baseUrl,
    calendarCurrent: currentResponse.status,
    calendarSelected: selectedResponse.status,
    brand: brandResponse.status,
    selectedDate,
  }));
} finally {
  deleteAuthSession(token);
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
}
