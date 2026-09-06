import assert from "node:assert/strict";
import { test } from "node:test";
import { taskDetailTabFromHash } from "@/lib/taskDetailNavigation";
test("pending delivery deep links open the containing tab while old anchors remain compatible", () => {
  assert.equal(taskDetailTabFromHash("#delivery-demo-version-1"), "delivery");
  assert.equal(taskDetailTabFromHash("#teslim"), "delivery");
  assert.equal(taskDetailTabFromHash("#gorev-ayrintilari"), "details");
  assert.equal(taskDetailTabFromHash("#revize"), "revision");
  for (const hash of ["#yorumlar", "#is-akisi", "#hareketler", "#other", ""]) assert.equal(taskDetailTabFromHash(hash), null);
});
