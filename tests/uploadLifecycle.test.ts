import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_UPLOAD_ROOT = path.join(os.tmpdir(), `inturlam-upload-lifecycle-${process.pid}`);
process.env.INTURLAM_UPLOAD_ROOT = TMP_UPLOAD_ROOT;
const { deleteUploadedFiles, withSavedImageFiles } = await import("@/lib/uploads");

function resetUploads() {
  fs.rmSync(TMP_UPLOAD_ROOT, { force: true, recursive: true });
}

beforeEach(resetUploads);
after(resetUploads);

describe("runtime upload yasam dongusu", () => {
  it("DB yazimi basarisiz olursa yeni dosyayi geri alir", async () => {
    const image = new File([new Uint8Array([1, 2, 3])], "rollback.png", { type: "image/png" });
    await assert.rejects(
      withSavedImageFiles([image], "tests", () => {
        throw new Error("DB failed");
      }),
      /DB failed/,
    );
    assert.equal(fs.existsSync(TMP_UPLOAD_ROOT), true);
    assert.equal(fs.readdirSync(path.join(TMP_UPLOAD_ROOT, "tests")).length, 0);
  });

  it("basarili yazimi korur ve toplu temizler", async () => {
    const image = new File([new Uint8Array([4, 5, 6])], "keep.png", { type: "image/png" });
    const saved = await withSavedImageFiles([image], "tests", (files) => files);
    const absolute = path.join(TMP_UPLOAD_ROOT, saved[0].filePath.replace(/^\/uploads\//, ""));
    assert.equal(fs.existsSync(absolute), true);
    await deleteUploadedFiles(saved.map((file) => file.filePath));
    assert.equal(fs.existsSync(absolute), false);
  });
});
