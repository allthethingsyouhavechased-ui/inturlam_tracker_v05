// Yerel/ilk kurulum için şifre belirleme.
//
// Neden var: şifreyi normalde bir YÖNETİCİ arayüzden veriyor (Ekip → Hesap
// yönetimi). Ama taze bir klonda henüz şifresi olan hiç kimse yok, yani hiç
// kimse giremiyor ve dolayısıyla kimse kimseye şifre veremiyor — tavuk-yumurta.
// Bu script yalnızca o kilidi açar. Günlük şifre sıfırlama için arayüzü kullan.
//
// Şifreler scrypt ile saklanıyor; VAR OLAN bir şifreyi geri okumak mümkün değil,
// bu script de okumaz — yalnızca yenisini yazar.
//
// Kullanım:
//   npm run db:set-password -- <kullanıcı-adı>
//
// Şifre komut satırından DEĞİL, sorulunca girilir: argümana yazılan bir şifre
// kabuk geçmişine ve süreç listesine düşer.
//
// `INTURLAM_DB_PATH` ile başka bir veritabanına yönlendirilebilir. Hangi dosyaya
// yazdığını her çalıştığında ekrana basar — yanlışlıkla canlı veriye yazmayı
// fark etmeden geçmek zor olsun diye.

import path from "node:path";
import { randomInt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { getDb } from "../lib/db/client.ts";
import { clearLoginBlockForPerson } from "../lib/auth/loginGate.ts";
import { hashPassword, validatePassword } from "../lib/auth/password.ts";
import { updatePersonPassword } from "../lib/repositories/people.ts";

const args = process.argv.slice(2);
const generate = args.includes("--olustur");
const [username] = args.filter((arg) => !arg.startsWith("--"));

if (!username) {
  console.error("Kullanım: node --import ./scripts/register.mjs db/set-password.mts <kullanıcı-adı> [--olustur]");
  process.exit(1);
}

// `--olustur`: şifreyi script'in KENDİSİ üretir ve bir kez ekrana basar.
// Etkileşimli soru sorulamayan ortamlar için (CI, otomasyon, kabuk geçmişine
// şifre yazmak istemediğin her yer). Karışabilecek karakterler (0/O, 1/l/I)
// alfabede yok — telefondan elle yazılabilsin diye.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 16): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const dbPath = process.env.INTURLAM_DB_PATH
  ?? path.join(process.cwd(), "data", "inturlam.db");
console.log(`Veritabanı: ${dbPath}`);

const db = getDb();
const person = db
  .prepare("SELECT id, name, username FROM people WHERE username = ? OR id = ?")
  .get(username, username) as { id: string; name: string; username: string | null } | undefined;

if (!person) {
  const known = db.prepare("SELECT username FROM people WHERE active = 1 ORDER BY username").all() as {
    username: string | null;
  }[];
  console.error(
    `"${username}" bulunamadı. Aktif kullanıcı adları: ${known.map((row) => row.username).filter(Boolean).join(", ")}`,
  );
  process.exit(1);
}

let password: string;
let confirm: string;

if (generate) {
  password = generatePassword();
  confirm = password;
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = (await rl.question(`${person.name} için yeni şifre: `)).trim();
  confirm = (await rl.question("Yeni şifre (tekrar): ")).trim();
  rl.close();
}

const invalid = validatePassword(password);
if (invalid) {
  console.error(invalid);
  process.exit(1);
}
if (password !== confirm) {
  console.error("Şifreler eşleşmiyor.");
  process.exit(1);
}

updatePersonPassword(person.id, hashPassword(password));
// Arayüzdeki sıfırlama ile aynı davranış: yeni şifre verildiği an giriş kilidi
// de kalkar, kişi 15 dakika kapıda beklemesin.
clearLoginBlockForPerson(person.id, person.username);

console.log(`${person.name} (${person.username ?? person.id}) için şifre güncellendi, giriş kilidi kaldırıldı.`);
if (generate) {
  console.log(`Şifre: ${password}`);
  console.log("Bu şifre bir daha gösterilemez. Girdikten sonra Ayarlar → Güvenlik'ten değiştir.");
}
