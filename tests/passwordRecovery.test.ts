import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function source(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

// "Şifremi unuttum" akışının iki taşıyıcı kuralı:
//   1. Şifre yenilenince giriş kilidi de kalkar. Bu olmadan kişi elinde DOĞRU
//      şifreyle 15 dakika daha giremiyor ve ekranda "çok fazla hatalı deneme"
//      yazıyordu — yani akış yarım kalıyordu.
//   2. Sıfırlama yolu giriş ekranından GÖRÜNÜR. Eskiden hiçbir yerde yazmıyordu.

describe("şifre yenileme giriş kilidini kaldırır", () => {
  const people = source("lib/actions/people.ts");

  it("ekip şifresi sıfırlanınca kilidi temizler", () => {
    const resetAt = people.indexOf("export async function resetPersonPasswordAction");
    assert.ok(resetAt >= 0, "resetPersonPasswordAction bulunamadı");
    const body = people.slice(resetAt, people.indexOf("export async function", resetAt + 10));
    assert.match(body, /updatePersonPassword\(/);
    assert.match(body, /clearLoginBlockForPerson\(/);
  });

  it("guest hesabına şifre verilince kilidi temizler", () => {
    assert.match(people, /upsertGuestAccount\([\s\S]{0,400}?clearLoginBlockForGuest\(/);
  });

  it("sayaç ortak modülde — action ile giriş aynı kilidi görüyor", () => {
    // `lib/actions/identity.ts` bir "use server" dosyası: oradan async olmayan
    // bir değer export edilemediği için sayaç ayrı bir modülde olmak ZORUNDA.
    const identity = source("lib/actions/identity.ts");
    assert.match(identity, /from "@\/lib\/auth\/loginGate"/);
    assert.doesNotMatch(identity, /new LoginThrottle\(/);
    assert.match(source("lib/auth/loginGate.ts"), /export const loginThrottle/);
  });
});

describe("giriş ekranında sıfırlama yolu görünür", () => {
  it("ekip ve guest formları şifre yardımına bağlanıyor", () => {
    assert.match(source("components/IdentityLoginForm.tsx"), /\/whoami\/sifre-yardim/);
    assert.match(source("components/IdentityLoginForm.tsx"), /Şifremi unuttum/);
    assert.match(source("components/GuestLoginForm.tsx"), /\/whoami\/sifre-yardim\?kind=guest/);
    assert.match(source("components/GuestLoginForm.tsx"), /Şifremi unuttum/);
  });

  it("yardım sayfası oturumsuz erişilebilir ve kimlik sızdırmıyor", () => {
    // `/whoami` public prefix'i altında olduğu için proxy geçiriyor.
    assert.match(source("proxy.ts"), /"\/whoami"/);
    const page = source("app/whoami/sifre-yardim/page.tsx");
    // Giriş ekranı bir personel dizinine dönüşmemeli: kişi/yönetici listesi çekilmemeli.
    assert.doesNotMatch(page, /listActivePeople|listManagers|from "@\/lib\/repositories/);
  });
});
