import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { instagramProfileUrl, normalizeInstagramHandle } from "@/lib/instagram";

describe("Instagram profil bağlantıları", () => {
  it("kullanıcı adı, @ biçimi ve tam profil URL'sini tek biçime getirir", () => {
    assert.equal(normalizeInstagramHandle("@sihirliolta"), "sihirliolta");
    assert.equal(
      normalizeInstagramHandle("https://www.instagram.com/sihirliolta/"),
      "sihirliolta",
    );
    assert.equal(instagramProfileUrl("sihirliolta"), "https://www.instagram.com/sihirliolta/");
  });

  it("geçersiz değerleri dış bağlantıya dönüştürmez", () => {
    assert.equal(instagramProfileUrl("javascript:alert(1)"), null);
    assert.equal(instagramProfileUrl("instagram.com/"), null);
    assert.equal(instagramProfileUrl(null), null);
  });
});
