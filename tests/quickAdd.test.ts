import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NEW_CONTENT_VALUE, resolveQuickAddContentId } from "@/lib/quickAdd";

describe("hızlı görev çalışma seçimi", () => {
  it("mevcut çalışmalar olsa bile ilk açılışta yeni çalışma ve görev türünü gösterir", () => {
    assert.equal(
      resolveQuickAddContentId(NEW_CONTENT_VALUE, ["sosyal", "basili"]),
      NEW_CONTENT_VALUE,
    );
  });

  it("kullanıcının seçtiği mevcut çalışmayı korur, geçersiz seçimi yeniye döndürür", () => {
    assert.equal(resolveQuickAddContentId("basili", ["sosyal", "basili"]), "basili");
    assert.equal(resolveQuickAddContentId("silinmis", ["sosyal"]), NEW_CONTENT_VALUE);
  });
});
