import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taskArchiveMenuLabel } from "@/lib/taskArchiveLabel";
import type { TaskStatus } from "@/lib/types";

function target(overrides: Partial<{ archived: boolean; status: TaskStatus }>): {
  archived: boolean;
  status: TaskStatus;
} {
  return {
    status: "Beklemede",
    archived: false,
    ...overrides,
  };
}

describe("görev sağ tık arşiv etiketi", () => {
  it("yayınlanmış açık görevi Arşivle olarak gösterir", () => {
    assert.equal(taskArchiveMenuLabel(target({ status: "Yayinlandi" })), "Arşivle");
  });

  it("yayınlanmamış açık görevi Görevi iptal et olarak gösterir", () => {
    assert.equal(taskArchiveMenuLabel(target({ status: "Incelemede" })), "Görevi iptal et");
  });

  it("arşivlenmiş görevi Yeniden aç olarak gösterir", () => {
    assert.equal(taskArchiveMenuLabel(target({ status: "Yayinlandi", archived: true })), "Yeniden aç");
  });
});
