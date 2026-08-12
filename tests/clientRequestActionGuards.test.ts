import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "lib", "actions", "clientRequests.ts"),
  "utf8",
);

describe("müşteri talebi karar yetkisi", () => {
  for (const [action, actor] of [
    ["createClientRequestAction", "actor"],
    ["updateClientRequestAction", "actor"],
    ["deleteClientRequestAction", "actor"],
    ["updateClientRequestReviewAction", "reviewer"],
    ["addClientRequestCommentAction", "reviewer"],
    ["approveClientRequestAction", "reviewer"],
    ["rejectClientRequestAction", "reviewer"],
  ] as const) {
    it(`${action} talep değerlendirme yetkisi korumasını çağırır`, () => {
      const start = source.indexOf(`export async function ${action}`);
      assert.notEqual(start, -1);
      const nextExport = source.indexOf("export async function", start + 1);
      const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
      assert.match(body, new RegExp(`const ${actor} = await requireSession\\(\\);`));
      assert.match(body, new RegExp(`assertReviewer\\(${actor}\\);`));
    });
  }
});
