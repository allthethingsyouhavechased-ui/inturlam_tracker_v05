import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("talep değerlendirme rota erişimi", () => {
  it("liste sayfası veriyi okumadan önce merkezi yetkiyi denetler", () => {
    const page = source("app/requests/page.tsx");
    const guard = page.indexOf("if (!canReviewClientRequests(person)) notFound()");
    const requestRead = page.indexOf("listClientRequestsForPerson(");

    assert.ok(guard >= 0);
    assert.ok(requestRead > guard);
  });

  it("detay sayfası talep kaydını okumadan önce merkezi yetkiyi denetler", () => {
    const page = source("app/requests/[requestId]/page.tsx");
    const guard = page.indexOf("if (!canReviewClientRequests(person)) notFound()");
    const requestRead = page.indexOf("getClientRequest(requestId)");

    assert.ok(guard >= 0);
    assert.ok(requestRead > guard);
    assert.doesNotMatch(page, /created_by_id !== person\.id/);
  });

  it("görev detayında kaynak talebi yalnızca yetkili kişi için okur", () => {
    const page = source("app/tasks/[taskId]/page.tsx");
    assert.match(
      page,
      /canReviewClientRequests\(me\)\s*\? getClientRequestByTask\(taskId\)\s*:\s*undefined/,
    );
  });
});
