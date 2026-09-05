import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { after, beforeEach, describe, it } from "node:test";
import { assertTargetMonth, assertTargetPoints, calculatePointTargetProgress, summarizePointTargets } from "@/lib/monthlyPointTargets";
import { buildPointTargetSheet } from "@/lib/pointTargetWorkbook";

const dbPath = path.join(os.tmpdir(), `inturlam-monthly-point-targets-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = dbPath;
const { getDb } = await import("@/lib/db/client");
const { getPersonPointTargetProgress, saveMonthlyPointTargets, listMonthlyPointTargets, listPointTargetChanges } = await import("@/lib/repositories/monthlyPointTargets");
const { getPersonMonthlyProgress, getPersonMonthlyProgressSummary, getBrandMonthlyProgress } = await import("@/lib/repositories/progress");
function reset() {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true });
}
beforeEach(() => {
  reset();
  const db = getDb();
  db.exec("INSERT INTO people(id,name,is_manager) VALUES('manager','Yönetici',1),('other-manager','Diğer Yönetici',1),('a','Ada',0),('b','Bora',0)");
  db.exec("INSERT INTO brands(id,name,cluster) VALUES('brand','Marka','tek'); INSERT INTO content_items(id,brand_id,title,type) VALUES('content','brand','İş','Reel')");
});
after(reset);
const month = "2026-09";
const update = (personId: string, targetPoints = 50, expectedPoints: number | null = null) => ({ personId, targetPoints, expectedPoints });
function task(id: string, points: number, status = "Yayinlandi", due = "2026-09-10", person = "a") {
  getDb().prepare("INSERT INTO tasks(id,content_item_id,title,weight_points,status,due_date,assignee_id) VALUES(?,'content',?,?,?,?,?)").run(id, id, points, status, due, person);
}

describe("bağımsız aylık kişi hedefleri", () => {
  for (const [earned, percent, remaining, extra] of [[0,0,50,0],[40,80,10,0],[50,100,0,0],[65,130,0,15],[70,140,0,20]]) {
    it(`${earned}/50 → yüzde ${percent}`, () => {
      if (earned) task("work", earned);
      saveMonthlyPointTargets("manager", month, [update("a")]);
      const result = getPersonPointTargetProgress("a", month);
      assert.equal(result.percent, percent); assert.equal(result.remaining_points, remaining); assert.equal(result.extra_points, extra);
    });
  }
  it("yeni atanmış işler hedefi veya kazanılmış hedef yüzdesini büyütmez", () => {
    task("done", 65); saveMonthlyPointTargets("manager", month, [update("a")]);
    task("new", 15, "Beklemede");
    const result = getPersonPointTargetProgress("a", month);
    assert.equal(result.assigned_points, 80); assert.equal(result.target_points, 50); assert.equal(result.percent, 130);
    assert.equal(getBrandMonthlyProgress("brand", month).percent, 81.3);
  });
  it("ay ve kişi hedeflerini ayrı tutar, fazla puanı sonraki aya taşımaz", () => {
    task("sept", 70); task("oct", 10, "Yayinlandi", "2026-10-01");
    saveMonthlyPointTargets("manager", month, [update("a"),update("b")]);
    saveMonthlyPointTargets("manager", "2026-10", [update("a",60)]);
    assert.equal(getPersonPointTargetProgress("a", month).percent, 140);
    assert.equal(getPersonPointTargetProgress("a", "2026-10").target_points, 60);
    assert.equal(getPersonPointTargetProgress("a", "2026-10").earned_points, 10);
    assert.equal(getPersonPointTargetProgress("b", month).remaining_points, 50);
  });
  it("hedef olmayan kişiyi sahte sıfır/sonsuz yüzde ile göstermez", () => {
    task("done", 70);
    const result = getPersonPointTargetProgress("a", month);
    assert.equal(result.earned_points,70); assert.equal(result.percent,null); assert.equal(result.remaining_points,null);
    assert.equal(result.target_points,null);
  });
  it("geçersiz hedef, dönem ve tekrarlı kişi listesini reddeder", () => {
    for (const value of [0,-1,1.5,NaN,Infinity,100001]) assert.throws(() => assertTargetPoints(value));
    for (const value of ["2026-00","2026-13","2026-99","26-09","2026-9","2026-09-01"]) assert.throws(() => assertTargetMonth(value));
    assert.throws(() => saveMonthlyPointTargets("manager",month,[update("a"),update("a")]));
    assert.equal(listPointTargetChanges(month).length,0);
    assert.throws(() => getDb().prepare("INSERT INTO person_monthly_point_targets(person_id,month,target_points) VALUES('a','2026-99',50)").run());
    assert.throws(() => getDb().prepare("INSERT INTO person_monthly_point_targets(person_id,month,target_points) VALUES('a','2026-09',0)").run());
  });
  it("çalışan, bilinmeyen veya pasif yönetici hedef yazamaz", () => {
    for (const actor of ["a","guest-account","unknown"]) assert.throws(() => saveMonthlyPointTargets(actor,month,[update("a")]));
    getDb().exec("UPDATE people SET active=0 WHERE id='manager'");
    assert.throws(() => saveMonthlyPointTargets("manager",month,[update("a")]));
    assert.equal(listPointTargetChanges(month).length,0);
  });
  it("toplu işlem hata verirse önceki satırları ve audit kaydını geri alır", () => {
    assert.throws(() => saveMonthlyPointTargets("manager",month,[update("a"),update("missing")]));
    assert.equal(getPersonPointTargetProgress("a",month).target_points,null);
    assert.equal(listPointTargetChanges(month).length,0);
  });
  it("retry idempotenttir, hedef değişimi eski/yeni değer ve aktörü saklar", () => {
    assert.equal(saveMonthlyPointTargets("manager",month,[update("a"),update("b")]),2);
    assert.equal(saveMonthlyPointTargets("manager",month,[update("a"),update("b")]),0);
    saveMonthlyPointTargets("other-manager",month,[update("a",60,50)],"İzin planı");
    const changes=listPointTargetChanges(month);
    assert.equal(changes.length,3); assert.equal(changes[0].previous_points,50); assert.equal(changes[0].target_points,60);
    assert.equal(changes[0].actor_name,"Diğer Yönetici"); assert.equal(changes[0].note,"İzin planı");
  });
  it("eski form başka yöneticinin hedefini ezmez", () => {
    saveMonthlyPointTargets("manager",month,[update("a")]);
    saveMonthlyPointTargets("other-manager",month,[update("a",60,50)]);
    assert.throws(() => saveMonthlyPointTargets("manager",month,[update("a",70,50)]), /hedef değişmiş/);
    assert.equal(getPersonPointTargetProgress("a",month).target_points,60);
  });
  it("iki eşzamanlı süreç aynı hedefi ve geçmiş kaydını çoğaltmaz", async () => {
    const code=`import {saveMonthlyPointTargets} from './lib/repositories/monthlyPointTargets.ts'; console.log(saveMonthlyPointTargets('manager','2026-09',[{personId:'a',targetPoints:50,expectedPoints:null}]));`;
    const run=promisify(execFile);
    const results=await Promise.all([1,2].map(() => run(process.execPath,["--import","./scripts/register.mjs","--input-type=module","-e",code],{env:{...process.env,INTURLAM_DB_PATH:dbPath}})));
    assert.deepEqual(results.map(r=>Number(r.stdout.trim())).sort(),[0,1]);
    assert.equal(listPointTargetChanges(month).length,1);
  });
  it("aşama katkısını, arşivi ve iç teslim ayını mevcut dökümle aynı hesaplar", () => {
    task("progress",20,"DevamEdiyor"); task("review",30,"Incelemede"); task("approved",10,"Onaylandi"); task("done",30);
    task("next",100,"Yayinlandi","2026-10-01");
    getDb().exec("UPDATE tasks SET archived_at='2026-09-11' WHERE id='done'");
    saveMonthlyPointTargets("manager",month,[update("a")]);
    assert.equal(getPersonPointTargetProgress("a",month).earned_points,62);
    assert.equal(getPersonPointTargetProgress("a",month).percent,124);
    assert.deepEqual(getPersonMonthlyProgressSummary("a",month),getPersonMonthlyProgress("a",month));
    getDb().exec("UPDATE tasks SET status='Beklemede' WHERE id='done'");
    assert.equal(getPersonPointTargetProgress("a",month).earned_points,32);
    getDb().exec("UPDATE tasks SET assignee_id='b' WHERE id='review'");
    assert.equal(getPersonPointTargetProgress("a",month).earned_points,14);
    assert.equal(getPersonPointTargetProgress("b",month).earned_points,18);
  });
  it("takım toplamı şahsi açığı örtmez ve eksik hedefli kişileri orana katmaz", () => {
    task("a-work",70); task("b-work",30,"Yayinlandi","2026-09-10","b"); task("unconfigured",100,"Yayinlandi","2026-09-10","manager");
    saveMonthlyPointTargets("manager",month,[update("a"),update("b")]);
    const rows=listMonthlyPointTargets(month); const summary=summarizePointTargets(rows);
    assert.equal(summary.percent,100); assert.equal(summary.reached_count,1); assert.equal(summary.missing_count,2);
    assert.equal(rows.find(r=>r.person_id==="b")!.remaining_points,20);
    const weighted=summarizePointTargets([
      calculatePointTargetProgress({month,weighted_total:50,weighted_earned:50,task_count:1,percent:100},50),
      calculatePointTargetProgress({month,weighted_total:150,weighted_earned:0,task_count:1,percent:0},150),
    ]);
    assert.equal(weighted.percent,25);
  });
  it("Excel ham sayı olarak %140 ve fazla puanı taşır; eksik hedef boş kalır", () => {
    task("done",70);saveMonthlyPointTargets("manager",month,[update("a")]);
    const rows=listMonthlyPointTargets(month);const sheet=buildPointTargetSheet(rows);
    const ada=sheet.rows.find(row=>row[1]==="Ada")!;
    assert.equal(ada[3],50);assert.equal(ada[4],70);assert.equal(ada[6],140);assert.equal(ada[8],20);
    assert.equal(sheet.rows.find(row=>row[1]==="Bora")![6],null);
  });
  it("eski veritabanına ek şema kayıpsız uygulanır, varsayılan hedef uydurulmaz", () => {
    task("existing",65);
    getDb().exec("DROP TABLE person_monthly_point_target_changes; DROP TABLE person_monthly_point_targets");
    getDb().close();globalThis.__inturlamDb=undefined;
    assert.equal(getPersonPointTargetProgress("a",month).earned_points,65);
    assert.equal(getPersonPointTargetProgress("a",month).target_points,null);
    saveMonthlyPointTargets("manager",month,[update("a")]);
    getDb().exec("UPDATE people SET active=0 WHERE id='a'");
    getDb().close();globalThis.__inturlamDb=undefined;
    assert.equal(getPersonPointTargetProgress("a",month).percent,130);
    assert.equal(listMonthlyPointTargets(month).find(r=>r.person_id==="a")!.active,0);
    assert.equal(listPointTargetChanges(month).length,1);
    assert.equal(getDb().prepare("PRAGMA integrity_check").get()!.integrity_check,"ok");
  });
});
