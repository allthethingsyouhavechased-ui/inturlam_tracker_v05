import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("form geri bildirimi", () => {
  it("ortak action formu tekrar gönderimi engeller ve sonucu erişilebilir biçimde duyurur", () => {
    const form = source("components/ActionForm.tsx");
    const submit = source("components/SubmitButton.tsx");

    assert.match(form, /getActionErrorMessage/);
    assert.match(form, /role="alert"/);
    assert.match(form, /role="status"/);
    assert.match(form, /aria-live="polite"/);
    assert.match(submit, /useFormStatus/);
    assert.match(submit, /disabled=\{pending\}/);
    assert.match(submit, /pendingLabel/);
  });

  it("guest ve hesap yönetimi formları ortak geri bildirim akışını kullanır", () => {
    const guestTasks = source("app/guest/tasks/page.tsx");
    const guestTask = source("app/guest/tasks/[taskId]/page.tsx");
    // Guest hesabı formu 2026-08-29'da hesap yönetiminden ayrı bir sayfaya
    // taşındı (listenin altında fark edilmiyordu).
    const accounts = source("app/team/manage/guest/page.tsx");

    for (const page of [guestTasks, guestTask, accounts]) {
      assert.match(page, /<ActionForm/);
      assert.match(page, /<SubmitButton/);
    }
    assert.match(source("lib/actions/guestTasks.ts"), /return taskId/);
    assert.doesNotMatch(source("lib/actions/guestTasks.ts"), /redirect\(`/);
  });

  it("takvim modalı bekleyen işlemi kilitler ve hatayı canlı bölgede duyurur", () => {
    const dialog = source("components/CalendarEventDialog.tsx");
    assert.match(dialog, /disabled=\{pending\}/);
    assert.match(dialog, /role="alert"/);
    assert.match(dialog, /getActionErrorMessage/);
    assert.match(dialog, /router\.refresh\(\)/);
  });

  it("görev ayrıntısı kaydetme hatasını sayfayı düşürmeden form içinde gösterir", () => {
    const page = source("app/tasks/[taskId]/page.tsx");

    assert.match(page, /<ActionForm[\s\S]*action=\{updateTaskDetailsAction\}/);
    assert.match(page, /successMessage="Görev ayrıntıları kaydedildi\."/);
    assert.doesNotMatch(page, /<form key="details" action=\{updateTaskDetailsAction\}/);
  });
});

describe("klavye ve hata erişilebilirliği", () => {
  it("guest kabuğu içerik atlama bağlantısı ve aktif sayfa bilgisi sunar", () => {
    const shell = source("components/GuestShell.tsx");
    const navigation = source("components/GuestNavigation.tsx");

    assert.match(shell, /href="#main-content"/);
    assert.match(shell, /tabIndex=\{-1\}/);
    assert.match(shell, /<GuestNavigation/);
    assert.match(navigation, /aria-current/);
    assert.match(navigation, /usePathname/);
  });

  it("talep düzenleme penceresinde odağı içeride tutar ve açan düğmeye geri verir", () => {
    const dialog = source("components/EditClientRequestForm.tsx");
    assert.match(dialog, /event\.key !== "Tab"/);
    assert.match(dialog, /focusableElements/);
    assert.match(dialog, /trigger\?\.focus/);
    assert.match(dialog, /aria-describedby="edit-request-description"/);
  });

  it("uygulama hata sınırı Next reset sözleşmesini ve güvenli mesajı kullanır", () => {
    const boundary = source("app/error.tsx");
    assert.match(boundary, /reset: \(\) => void/);
    assert.match(boundary, /onClick=\{reset\}/);
    assert.doesNotMatch(boundary, /unstable_retry/);
    assert.doesNotMatch(boundary, /\{error\.message/);
  });
});

describe("mobil takvim ve bağlantısız kod", () => {
  it("aylık takvimi dar ekranda erişilebilir yatay kaydırma alanına alır", () => {
    const grid = source("components/EventCalendarGrid.tsx");
    assert.match(grid, /overflow-x-auto/);
    assert.match(grid, /min-w-\[\d+rem\]/);
    assert.match(grid, /role="region"/);
    assert.match(grid, /tabIndex=\{0\}/);
    assert.match(grid, /yatay kaydır/);
  });

  it("artık kullanılmayan eski bileşenleri kaynak ağaçta tutmaz", () => {
    for (const path of [
      "components/CalendarGrid.tsx",
      "components/BrandViewToggle.tsx",
      "components/HeaderRouteContext.tsx",
      "components/SidebarClusterGroup.tsx",
    ]) {
      assert.equal(existsSync(join(process.cwd(), path)), false, `${path} silinmiş olmalı`);
    }
    assert.doesNotMatch(source("lib/constants.ts"), /BRAND_VIEW_COOKIE/);
  });
});
