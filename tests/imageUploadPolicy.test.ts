import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, it } from "node:test";
import sharp from "sharp";
import { VALID_PNG } from "./fixtures/image.ts";
import { validateImageFiles, MAX_IMAGE_SIZE } from "@/lib/imageUploadPolicy";
import { extractImageFiles, validateImageContent, withSavedImageFiles } from "@/lib/uploads";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "intracker-upload-policy-"));
process.env.INTURLAM_UPLOAD_ROOT = root;
after(() => fs.rm(root, { recursive: true, force: true }));
const png = () => new File([VALID_PNG], "image.png", { type: "image/png" });

it("yedinci dosyayı sessizce kırpmaz, bütün isteği reddeder", () => {
  const form = new FormData();
  for (let i = 0; i < 7; i++) form.append("images", png());
  assert.equal(extractImageFiles(form).length, 7);
  assert.throws(() => validateImageFiles(extractImageFiles(form)), /6 görsel/);
});
it("boş, sahte MIME, tek dosya ve toplam boyut sınırlarını uygular", () => {
  const file = { name: "a.png", type: "image/png", size: 8 * 1024 * 1024 };
  assert.doesNotThrow(() => validateImageFiles([file, file, { ...file, size: 4 * 1024 * 1024 }]));
  assert.doesNotThrow(() => validateImageFiles([{ ...file, size: MAX_IMAGE_SIZE }]));
  assert.throws(() => validateImageFiles([file, file, file]), /20 MB/);
  assert.throws(() => validateImageFiles([{ ...file, size: MAX_IMAGE_SIZE + 1 }]), /20 MB/);
  assert.throws(() => validateImageFiles([{ ...file, size: 0 }]), /boş/);
  assert.throws(() => validateImageFiles([{ ...file, type: "toString" }]), /yalnız/);
});
it("bozuk ve MIME türü uyuşmayan içeriği reddeder", async () => {
  await assert.rejects(validateImageContent(new File(["not an image"], "fake.png", { type: "image/png" })), /bozuk/);
  await assert.rejects(validateImageContent(new File([VALID_PNG], "fake.jpg", { type: "image/jpeg" })), /türü/);
  await assert.rejects(validateImageContent(new File([VALID_PNG.subarray(0, 65)], "cut.png", { type: "image/png" })), /bozuk/);
});
it("izinli dört formatın piksel içeriğini açar, baytları değiştirmez", async () => {
  for (const format of ["png", "jpeg", "gif", "webp"] as const) {
    const bytes = await sharp(VALID_PNG).toFormat(format).toBuffer();
    assert.deepEqual(await validateImageContent(new File([new Uint8Array(bytes)], `image.${format}`, { type: `image/${format}` })), bytes);
  }
});
it("piksel sınırını aşan küçük sıkıştırılmış dosyayı reddeder", async () => {
  const bytes = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(validateImageContent(new File([new Uint8Array(bytes)], "large.png", { type: "image/png" })), /piksel/);
});
it("ikinci görsel bozuksa ilk dosyayı temizler ve DB yazmaz", async () => {
  let persisted = false;
  await assert.rejects(withSavedImageFiles([png(), new File(["bad"], "bad.png", { type: "image/png" })], "batch", () => { persisted = true; }), /bozuk/);
  assert.equal(persisted, false);
  assert.deepEqual(await fs.readdir(path.join(root, "batch")), []);
});
