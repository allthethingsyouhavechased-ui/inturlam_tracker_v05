import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib", "actions", "clientRequests.ts"),
  "utf8",
);

describe("müşteri talebi karar yetkisi", () => {
  for (const action of [
    "updateClientRequestReviewAction",
    "addClientRequestCommentAction",
    "approveClientRequestAction",
    "rejectClientRequestAction",
  ]) {
    it(`${action} talep değerlendirme yetkisi korumasını çağırır`, () => {
      const start = source.indexOf(`export async function ${action}`);
      assert.notEqual(start, -1);
      const nextExport = source.indexOf("export async function", start + 1);
      const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
      assert.match(body, /const reviewer = await requireSession\(\);/);
      assert.match(body, /assertReviewer\(reviewer\);/);
    });
  }
});
