// Pano sütunları. Eski beş sütuna YALNIZCA "Revizede" eklendi; müşteri
// aşamaları ayrı sütun açmıyor (sekiz sütun panoyu okunmaz yapıyordu). Ama o
// görevler panodan KAYBOLMAMALI: "Onaylandı" sütununda, müşteri rozetiyle
// görünürler.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  BOARD_STATUSES,
  CUSTOMER_STAGE_BADGE,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  boardColumnFor,
} from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";

describe("pano sütunları", () => {
  it("eski beş sütun + Revizede, sırayla", () => {
    assert.deepEqual(BOARD_STATUSES, [
      "Beklemede", "DevamEdiyor", "Incelemede", "Revizede", "Onaylandi", "Yayinlandi",
    ]);
  });

  it("müşteri aşamaları sütun AÇMIYOR", () => {
    assert.equal(BOARD_STATUSES.includes("MusteriIncelemede"), false);
    assert.equal(BOARD_STATUSES.includes("MusteriOnayladi"), false);
  });

  it("müşteri aşamasındaki görev Onaylandı sütununda görünüyor", () => {
    assert.equal(boardColumnFor("MusteriIncelemede"), "Onaylandi");
    assert.equal(boardColumnFor("MusteriOnayladi"), "Onaylandi");
  });

  it("pano durumları kendi sütunlarına düşüyor", () => {
    for (const status of BOARD_STATUSES) assert.equal(boardColumnFor(status), status);
  });

  it("müşteri aşamaları kartta rozetle ayrışıyor", () => {
    assert.equal(CUSTOMER_STAGE_BADGE.MusteriIncelemede, "Müşteride");
    assert.equal(CUSTOMER_STAGE_BADGE.MusteriOnayladi, "Müşteri onayladı");
    // Pano durumlarının rozeti YOK: sütun başlığı zaten söylüyor.
    for (const status of BOARD_STATUSES) assert.equal(CUSTOMER_STAGE_BADGE[status], undefined);
  });

  it("seçilebilir durumlar sütunlardan GENİŞ: müşteri aşamaları seçilebilir", () => {
    for (const status of BOARD_STATUSES) assert.ok(TASK_STATUSES.includes(status));
    assert.ok(TASK_STATUSES.includes("MusteriIncelemede"));
    assert.ok(TASK_STATUSES.includes("MusteriOnayladi"));
  });

  it("sütun etiketleri eski adlandırmaya döndü", () => {
    assert.equal(TASK_STATUS_LABEL.Incelemede, "İncelemede");
    assert.equal(TASK_STATUS_LABEL.Onaylandi, "Onaylandı");
  });

  it("panoda görünmeyen tek durum eski v02 kalıntısı", () => {
    const hidden = TASK_STATUSES.concat("IptalEdildi" as TaskStatus)
      .filter((status) => boardColumnFor(status) === null);
    assert.deepEqual(hidden, ["IptalEdildi"]);
  });
});

describe("pano sürükleme", () => {
  const boards = ["components/TaskBoard.tsx", "components/KanbanBoard.tsx"];

  it("sütunları BOARD_STATUSES'tan üretiyor ve kartları boardColumnFor ile eşliyor", () => {
    for (const file of boards) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.match(source, /BOARD_STATUSES\.map/, `${file} sütunları BOARD_STATUSES'tan üretmeli`);
      assert.match(source, /boardColumnFor\(t\.status\) === s(tatus)?/, `${file} kartları sütuna eşlemeli`);
    }
  });

  it("kart zaten o sütundaysa durum yazmıyor (müşteri aşaması geri düşmesin)", () => {
    for (const file of boards) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      assert.match(
        source,
        /if \(!task \|\| boardColumnFor\(task\.status\) === newStatus\) return;/,
        `${file} aynı sütun içindeki sürüklemede durum değiştirmemeli`,
      );
    }
  });
});
