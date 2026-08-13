import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanDeactivatePerson,
  assertCanManageRoles,
  canManageRoles,
  ROLE_ADMIN_PERSON_ID,
} from "@/lib/auth/authorization";

describe("yönetici rolü atama yetkisi", () => {
  it("yalnızca sabit Yunus Emre hesabına izin verir", () => {
    assert.equal(ROLE_ADMIN_PERSON_ID, "yunus");
    assert.equal(canManageRoles({ id: "yunus" }), true);
    assert.equal(canManageRoles({ id: "erhan" }), false);
    assert.equal(canManageRoles({ id: "sila" }), false);
    assert.equal(canManageRoles(null), false);
  });

  it("yetkisiz kişiyi sunucu aksiyonu çağrılmadan önce reddeder", () => {
    assert.doesNotThrow(() => assertCanManageRoles({ id: "yunus" }));
    assert.throws(
      () => assertCanManageRoles({ id: "berkant" }),
      /yalnızca Yunus Emre/,
    );
  });

  it("korunan sistem yöneticisinin pasife alınmasını reddeder", () => {
    assert.doesNotThrow(() => assertCanDeactivatePerson("sila"));
    assert.throws(
      () => assertCanDeactivatePerson(ROLE_ADMIN_PERSON_ID),
      /Sistem yöneticisi pasife alınamaz/,
    );
  });
});
