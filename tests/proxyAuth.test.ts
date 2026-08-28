import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server.js";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-proxy-auth-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { createAuthSession, createGuestAuthSession } = await import("@/lib/repositories/authSessions");
const { proxy } = await import("../proxy.ts");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function request(pathname: string, options?: { method?: string; token?: string }): NextRequest {
  const headers = new Headers();
  if (options?.token) headers.set("cookie", `inturlam_v03_session=${options.token}`);
  return new NextRequest(`http://localhost${pathname}`, {
    method: options?.method ?? "GET",
    headers,
  });
}

beforeEach(resetDb);
after(resetDb);

describe("merkezi oturum kapısı", () => {
it("uygulama manifestini oturum kapısının dışında bırakır", () => {
    // Tarayıcı "ana ekrana ekle" için manifesti oturum çerezi OLMADAN isteyebiliyor.
    // Gate'lenirse istek /whoami'ye düşer ve uygulama adı/ikonu hiç okunmaz.
    const response = proxy(request("/manifest.webmanifest"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
  });


  it("oturumsuz panel gezintisini giriş ekranına gönderir", () => {
    const response = proxy(request("/tasks"));

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "http://localhost/whoami");
  });

  it("oturumsuz mutasyon isteğini yönlendirmeden 401 ile keser", () => {
    const db = getDb();
    const before = Number(db.prepare("SELECT COUNT(*) AS n FROM tasks").get()?.n ?? 0);
    const response = proxy(request("/tasks", { method: "POST" }));
    const afterCount = Number(db.prepare("SELECT COUNT(*) AS n FROM tasks").get()?.n ?? 0);

    assert.equal(response.status, 401);
    assert.equal(afterCount, before);
  });

  it("geçersiz cookie'yi giriş sayfasına yönlendirirken temizler", () => {
    const response = proxy(request("/tasks", { token: "invalid-token" }));

    assert.equal(response.status, 307);
    assert.match(response.headers.get("set-cookie") ?? "", /inturlam_v03_session=;/);
  });

  it("yalnızca geçerli veritabanı oturumuyla paneli geçirir", () => {
    const db = getDb();
    db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ada')").run();
    const token = createAuthSession("p1");
    const response = proxy(request("/tasks", { token }));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });

  it("giriş ekranını oturumsuz erişime açık bırakır", () => {
    const response = proxy(request("/whoami"));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});

describe("guest rota sınırı", () => {
  it("guest yalnızca guest kabuğuna geçer ve ekip rotalarını reddeder", () => {
    const db = getDb();
    db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek')").run();
    db.prepare("INSERT INTO accounts (id, kind, brand_id, username, password_hash) VALUES ('g1', 'guest', 'b1', 'marka', 'hash')").run();
    const token = createGuestAuthSession("g1");
    assert.equal(proxy(request("/guest/tasks", { token })).status, 200);
    const page = proxy(request("/reports", { token }));
    assert.equal(page.status, 307);
    assert.equal(page.headers.get("location"), "http://localhost/guest");
    assert.equal(proxy(request("/reports/export", { method: "POST", token })).status, 403);
  });

  it("giriş ve marka logolarını oturumsuz erişime açık bırakır", () => {
    for (const pathname of ["/inturlam-logo.jpg", "/logos/marka.png"]) {
      const response = proxy(request(pathname));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-middleware-next"), "1");
    }
  });
});

describe("talep değerlendirme ağ geçidi", () => {
  it("yetkisiz oturumu liste ve detay sayfasından uzaklaştırır", () => {
    const db = getDb();
    db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ada')").run();
    const token = createAuthSession("p1");

    for (const pathname of ["/requests", "/requests/request-1"]) {
      const response = proxy(request(pathname, { token }));
      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), "http://localhost/");
    }
  });

  it("yetkisiz talep mutasyonunu 403 ile keser", () => {
    const db = getDb();
    db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ada')").run();
    const token = createAuthSession("p1");
    const response = proxy(request("/requests", { method: "POST", token }));

    assert.equal(response.status, 403);
  });

  it("izin listesindeki hesabı talep sayfasına geçirir", () => {
    const db = getDb();
    db.prepare("INSERT INTO people (id, name) VALUES ('yunus', 'Yunus Emre')").run();
    const token = createAuthSession("yunus");
    const response = proxy(request("/requests", { token }));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});

describe("rapor ağ geçidi", () => {
  it("yönetici olmayan hesabı rapor sayfalarından ve dışa aktarımdan uzaklaştırır", () => {
    const db = getDb();
    db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('p1', 'Ada', 0)").run();
    const token = createAuthSession("p1");

    const pageResponse = proxy(request("/reports", { token }));
    const exportResponse = proxy(request("/reports/export", { method: "POST", token }));

    assert.equal(pageResponse.status, 307);
    assert.equal(pageResponse.headers.get("location"), "http://localhost/");
    assert.equal(exportResponse.status, 403);
  });

  it("yönetici hesabını rapor sayfalarına geçirir", () => {
    const db = getDb();
    db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('p1', 'Ada', 1)").run();
    const token = createAuthSession("p1");
    const response = proxy(request("/reports", { token }));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});

describe("giriş cookie politikası", () => {
  it("kalıcı cookie üretmez ve SameSite strict kullanır", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "lib/actions/identity.ts"), "utf8");

    assert.doesNotMatch(source, /maxAge\s*:/);
    assert.match(source, /sameSite:\s*["']strict["']/);
  });
});
