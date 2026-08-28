import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// Bu dosya, kaldırılan sınıf-string testlerinin YERİNE geçen türden bir test:
// görünümü değil, tasarım sisteminin DOĞRULUK KURALLARINI koruyor. Buradaki her
// assert bir zamanlar gerçekten yaşanmış bir hatayı yakalar:
//   - `--shadow-lift` yalnızca `:root`ta tanımlıydı, koyu temada siyah gölge
//     #0c0c0e zeminde görünmüyordu;
//   - `@theme inline` içinde bir token kendine referans veriyordu (katman sırası
//     değişse sessizce geçersiz değere düşerdi);
//   - `prefers-reduced-motion` bloğu renk ve odak geçişlerini de kesiyordu.
// Renk DEĞERİ değişebilir, bu testler kırılmaz. Kural bozulursa kırılır.
function css(): string {
  return readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
}

/** Yorum satırlarını çıkarır — örnek kod içeren yorumlar tarayıcıları yanıltıyor. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Üst seviye (girintisiz) bir seçicinin süslü parantez gövdesini döndürür. */
function block(source: string, selector: string): string {
  const start = source.indexOf(`\n${selector} {`);
  assert.ok(start >= 0, `${selector} bloğu bulunamadı`);
  const open = source.indexOf("{", start);
  const end = source.indexOf("\n}", open);
  assert.ok(end > open, `${selector} bloğu kapanmıyor`);
  return source.slice(open + 1, end);
}

function declaredTokens(body: string): Set<string> {
  return new Set(
    [...body.matchAll(/^[ \t]*(--[a-z0-9-]+)[ \t]*:/gim)].map((match) => match[1]),
  );
}

describe("tema token'ları", () => {
  const raw = css();
  const source = withoutComments(raw);
  const light = declaredTokens(block(source, ":root"));
  const dark = declaredTokens(block(source, ".dark"));

  it("koyu temada yeniden tanımlanan her token'ın açık temada da karşılığı var", () => {
    const orphans = [...dark].filter((token) => !light.has(token));
    assert.deepEqual(
      orphans,
      [],
      `yalnızca .dark içinde tanımlı token(lar): ${orphans.join(", ")} — açık temada değerleri boş kalır`,
    );
  });

  it("temaya duyarlı token'lar İKİ temada da tanımlı", () => {
    // Bunlar ham CSS ya da utility üzerinden okunuyor ve tek bir sabit değer
    // iki temada birden 4.5:1'i karşılayamıyor. Yeni bir semantik renk
    // eklersen listeye de ekle.
    for (const token of ["--shadow-lift", "--danger", "--success", "--warning", "--info"]) {
      assert.ok(light.has(token), `${token} :root içinde yok`);
      assert.ok(dark.has(token), `${token} .dark içinde yok — koyu temada açık temanın değeri kalır`);
    }
  });

  it("hiçbir özel özellik kendine referans vermiyor", () => {
    const selfRefs = [...source.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(\s*(--[a-z0-9-]+)\s*\)/gi)]
      .filter((match) => match[1] === match[2])
      .map((match) => match[1]);
    assert.deepEqual(selfRefs, [], `kendine referans veren token(lar): ${selfRefs.join(", ")}`);
  });

  it("semantik renkleri @theme'e sabit değil değişken olarak bağlıyor", () => {
    for (const [utility, token] of [
      ["--color-danger", "--danger"],
      ["--color-success", "--success"],
      ["--color-warning", "--warning"],
      ["--color-info", "--info"],
    ]) {
      assert.ok(
        source.includes(`${utility}: var(${token})`),
        `${utility} sabit renge bağlanmış — tema değişimini takip etmez`,
      );
    }
  });

  it("tipografi ölçeğini token olarak yayınlıyor", () => {
    for (const step of ["display", "h1", "h2", "body", "caption", "eyebrow"]) {
      assert.ok(source.includes(`--text-${step}:`), `--text-${step} tanımlı değil`);
    }
    // Tracking boy-özel olmalı: display negatife, eyebrow pozitife gider.
    assert.ok(source.includes("--text-display--letter-spacing: -"));
    assert.ok(source.includes("--text-eyebrow--letter-spacing: 0.1em"));
  });
});

describe("hareket ve materyal tercihleri", () => {
  const source = css();

  it("azaltılmış harekette renk/opaklık geçişlerini KORUYOR, sadece dönüşümü kaldırıyor", () => {
    const start = source.indexOf("@media (prefers-reduced-motion: reduce)");
    assert.ok(start >= 0, "prefers-reduced-motion bloğu yok");
    const reduced = source.slice(start, source.indexOf("@media (prefers-reduced-transparency"));

    assert.ok(reduced.includes("transition-property: color"), "renk geçişi korunmuyor");
    assert.ok(reduced.includes("opacity"), "opaklık geçişi korunmuyor");
    assert.ok(
      !reduced.includes("transition-duration: 1ms"),
      "geçişleri tamamen kesmek durum geri bildirimini de siliyor",
    );
    assert.ok(reduced.includes("transform: none"), "dönüşüm kaldırılmıyor");
  });

  it("saydamlık ve kontrast tercihlerinde buzlu cam yüzeyi düzleştiriyor", () => {
    assert.ok(source.includes("@media (prefers-reduced-transparency: reduce)"));
    assert.ok(source.includes("@media (prefers-contrast: more)"));
    const start = source.indexOf("@media (prefers-reduced-transparency: reduce)");
    assert.ok(source.slice(start, start + 220).includes("backdrop-filter: none"));
  });

  it("spring eğrisini yalnızca sürükleme durumunda kullanıyor", () => {
    // Hover günde yüzlerce kez görülüyor; 360ms spring orada tarama hızını düşürür.
    const base = withoutComments(source).slice(
      withoutComments(source).indexOf(".ui-press,"),
      withoutComments(source).indexOf(".ui-enter"),
    );
    assert.ok(base.includes("transition-duration: var(--motion-standard)"));
    assert.ok(!base.includes("--motion-spring"), "spring varsayılan etkileşim hızı olmamalı");

    const drag = source.slice(source.indexOf('.ui-surface[data-dragging="true"]'));
    assert.ok(drag.slice(0, 320).includes("var(--motion-ease-spring)"));
  });
});

describe("sürükle-bırak erişilebilirliği", () => {
  it("iki pano da Türkçe ekran okuyucu duyurusu veriyor", () => {
    for (const file of ["components/TaskBoard.tsx", "components/KanbanBoard.tsx"]) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      assert.ok(src.includes("accessibility={{ announcements"), `${file} announcements geçmiyor`);
      assert.ok(src.includes("TASK_DRAG_INSTRUCTIONS"), `${file} klavye yönergesi geçmiyor`);
    }
  });
});
