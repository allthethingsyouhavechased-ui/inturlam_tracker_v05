import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { describe, it } from "node:test";
import { getPendingUndo, runUndoable, subscribeUndo } from "@/lib/undoQueue";

// Geri alma kuyruğunun taşıyıcı kuralı: işlem, süre dolana kadar HİÇ çalışmaz.
// Bu test o kuralı kilitliyor — "geri al"a basılan bir silme sunucuya gitmemeli.

describe("geri alınabilir işlem kuyruğu", () => {
  it("süre dolmadan gerçek işlemi ÇALIŞTIRMAZ", async () => {
    let committed = 0;
    runUndoable({ message: "1 görev silindi", delayMs: 60, commit: () => { committed += 1; }, rollback: () => {} });

    assert.equal(committed, 0, "bekleme süresi içinde işlem çalışmamalı");
    assert.equal(getPendingUndo()?.message, "1 görev silindi");

    await delay(100);
    assert.equal(committed, 1);
    assert.equal(getPendingUndo(), null, "işlendikten sonra çubuk kapanmalı");
  });

  it("geri alınca işlem hiç çalışmaz, geri sarma çalışır", async () => {
    let committed = 0;
    let rolledBack = 0;
    runUndoable({ message: "3 görev silindi", delayMs: 60, commit: () => { committed += 1; }, rollback: () => { rolledBack += 1; } });

    getPendingUndo()?.undo();
    assert.equal(rolledBack, 1);
    assert.equal(getPendingUndo(), null);

    await delay(100);
    assert.equal(committed, 0, "geri alınan işlem sonradan da çalışmamalı");
  });

  it("ikinci istek gelirse birincisi hemen işlenir", async () => {
    const order: string[] = [];
    runUndoable({ message: "ilk", delayMs: 1000, commit: () => order.push("ilk"), rollback: () => {} });
    runUndoable({ message: "ikinci", delayMs: 60, commit: () => order.push("ikinci"), rollback: () => {} });

    assert.deepEqual(order, ["ilk"], "yeni silme öncekini fiilen onaylar");
    assert.equal(getPendingUndo()?.message, "ikinci");

    await delay(100);
    assert.deepEqual(order, ["ilk", "ikinci"]);
  });

  it("aynı işlem iki kez sonuçlanamaz", async () => {
    let committed = 0;
    let rolledBack = 0;
    runUndoable({ message: "tek", delayMs: 40, commit: () => { committed += 1; }, rollback: () => { rolledBack += 1; } });

    const pending = getPendingUndo();
    pending?.undo();
    pending?.undo();

    await delay(80);
    assert.equal(rolledBack, 1);
    assert.equal(committed, 0);
  });

  it("abone olanları durum değiştikçe uyarır", async () => {
    let notified = 0;
    const unsubscribe = subscribeUndo(() => { notified += 1; });

    runUndoable({ message: "abone", delayMs: 40, commit: () => {}, rollback: () => {} });
    assert.ok(notified >= 1, "kuyruğa girince haber verilmeli");

    await delay(80);
    assert.ok(notified >= 2, "işlendiğinde de haber verilmeli");
    unsubscribe();
  });
});
