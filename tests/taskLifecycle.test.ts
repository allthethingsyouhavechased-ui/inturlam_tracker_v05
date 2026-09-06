import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { after, beforeEach, describe, it } from "node:test";

const dbPath = path.join(os.tmpdir(), `intracker-lifecycle-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = dbPath;
const { getDb } = await import("@/lib/db/client");
const { createTask, getTask, updateTaskStatus, bulkUpdateTaskStatus, updateTaskRepeat, startTaskRevision, completeTaskRevision } = await import("@/lib/repositories/tasks");
const { createTaskDelivery, decideTaskDelivery, listTaskDeliveries } = await import("@/lib/repositories/deliveries");
const { nextOccurrenceDate } = await import("@/lib/taskLifecycle");

function clean() {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true });
}
beforeEach(() => {
  clean();
  const db = getDb();
  db.exec(`INSERT INTO brands (id,name,cluster) VALUES ('b','Marka','tek'),('other','Diğer','tek');
    INSERT INTO people (id,name,is_manager) VALUES ('manager','Yönetici',1),('member','Üye',0);
    INSERT INTO accounts (id,kind,person_id) VALUES ('tm','team','manager'),('tu','team','member');
    INSERT INTO accounts (id,kind,brand_id,username) VALUES ('g','guest','b','guest'),('bad','guest','other','otherguest');
    INSERT INTO content_items (id,brand_id,title,type) VALUES ('c','b','İçerik','Reel');`);
});
after(clean);

function task(dueDate = "2026-01-31", repeat = 7) {
  const id = createTask({ contentItemId: "c", title: "Kurgu", assigneeId: "member", dueDate, difficulty: "Zor", weightPoints: 25, priority: "Acil", contentType: "Video" });
  updateTaskRepeat(id, repeat || null);
  return id;
}
function successor(id: string) {
  return (getDb().prepare("SELECT successor_task_id FROM task_recurrence_occurrences WHERE source_task_id=?").get(id) as { successor_task_id: string } | undefined)?.successor_task_id;
}
function submit(taskId: string, guestVisible = false) {
  return createTaskDelivery({ taskId, guestVisible, note: "Yeni sürüm", externalUrl: null, submittedByAccountId: "tu", submittedByName: "Üye", submittedByPersonId: "member" });
}
function approve(deliveryId: string) {
  return decideTaskDelivery({ deliveryId, decision: "Onaylandi", actorKind: "team", actorAccountId: "tm", actorPersonId: "manager", actorName: "Yönetici", decisionNote: null, revisionReason: null, revisionTargetMinutes: null });
}

describe("tekrar ve teslim durum sözleşmesi", () => {
  it("tekli yayın puan/atama/tür/aralığı korur, oluşuma ait not ve teslimi kopyalamaz", () => {
    const id = task();
    getDb().prepare("UPDATE tasks SET notes='Eski oluşuma ait not' WHERE id=?").run(id);
    assert.equal(updateTaskStatus(id, "Yayinlandi", "member"), true);
    const next = getTask(successor(id)!);
    assert.ok(next);
    assert.equal(next.weight_points, 25); assert.equal(next.difficulty, "Zor");
    assert.equal(next.assignee_id, "member"); assert.equal(next.content_type, "Video");
    assert.equal(next.priority, "Acil"); assert.equal(next.repeat_days, 7);
    assert.equal(next.due_date, "2026-02-07"); assert.equal(next.status, "Beklemede");
    assert.equal(next.notes, null); assert.equal(next.completed_at, null);
    assert.equal(listTaskDeliveries(next.id).length, 0);
  });

  it("toplu yayın tekliyle aynı, tekrar deneme ve yeniden açma tek ardıl üretir", () => {
    const a = task(), b = task();
    assert.equal(bulkUpdateTaskStatus([a,b,a], "Yayinlandi", "member"), 2);
    const first = successor(a);
    assert.equal(updateTaskStatus(a, "Yayinlandi", "member"), false);
    updateTaskStatus(a, "DevamEdiyor", "member");
    updateTaskStatus(a, "Yayinlandi", "member");
    assert.equal(successor(a), first);
    assert.equal(getTask(successor(b)!)?.due_date, "2026-02-07");
    assert.equal(getTask(successor(b)!)?.weight_points, 25);
    assert.equal((getDb().prepare("SELECT COUNT(*) n FROM tasks").get() as {n:number}).n, 4);
    updateTaskStatus(first!, "Yayinlandi", "member");
    const series = getDb().prepare("SELECT DISTINCT series_id FROM task_recurrence_occurrences WHERE source_task_id IN (?,?)").all(a, first!);
    assert.equal(series.length, 1);
  });

  it("ardıl insert hatasında tüm toplu yayın, olaylar ve kişisel hedef silmesi geri alınır", () => {
    const a = task(), b = task();
    getDb().prepare("INSERT INTO task_personal_targets (task_id,person_id,target_date) VALUES (?,'member','2026-01-30')").run(a);
    getDb().exec("CREATE TRIGGER fail_successor BEFORE INSERT ON task_recurrence_occurrences BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
    assert.throws(() => bulkUpdateTaskStatus([a,b], "Yayinlandi", "member"), /fixture failure/);
    assert.equal(getTask(a)?.status, "Beklemede"); assert.equal(getTask(b)?.status, "Beklemede");
    assert.equal((getDb().prepare("SELECT COUNT(*) n FROM tasks").get() as {n:number}).n, 2);
    assert.equal((getDb().prepare("SELECT COUNT(*) n FROM task_status_events").get() as {n:number}).n, 0);
    assert.equal((getDb().prepare("SELECT COUNT(*) n FROM task_personal_targets").get() as {n:number}).n, 1);
  });

  it("silinen ardıl yeniden yayınlamada diriltilmez", () => {
    const id = task(); updateTaskStatus(id,"Yayinlandi","member");
    getDb().prepare("DELETE FROM tasks WHERE id=?").run(successor(id)!);
    updateTaskStatus(id,"DevamEdiyor","member"); updateTaskStatus(id,"Yayinlandi","member");
    assert.equal(successor(id), null);
    assert.equal((getDb().prepare("SELECT COUNT(*) n FROM tasks").get() as {n:number}).n,1);
  });

  it("takvim günü politikası yıl, artık yıl, 31 Ocak ve yanlış tarih sınırlarında nettir", () => {
    assert.equal(nextOccurrenceDate("2024-02-28",1),"2024-02-29");
    assert.equal(nextOccurrenceDate("2024-02-29",1),"2024-03-01");
    assert.equal(nextOccurrenceDate("2026-01-31",30),"2026-03-02");
    assert.equal(nextOccurrenceDate("2026-12-31",1),"2027-01-01");
    for (const date of ["2026-02-29","2026-00-10","2026-13-01"]) assert.throws(()=>nextOccurrenceDate(date,7),/geçersiz/);
    assert.throws(()=>nextOccurrenceDate("2026-01-31",0),/aralığı/);
  });

  it("bekleyen teslim genel tekli/toplu onay ve yayını atomik engeller", () => {
    const id = task(), other = task(); submit(id);
    for (const status of ["Onaylandi","Yayinlandi","DevamEdiyor"] as const) {
      assert.throws(()=>updateTaskStatus(id,status,"manager"),/Bekleyen teslim/);
      assert.throws(()=>bulkUpdateTaskStatus([other,id],status,"manager"),/Bekleyen teslim/);
      assert.equal(getTask(other)?.status,"Beklemede");
      assert.equal(getTask(id)?.status,"Incelemede");
    }
  });

  it("teslimsiz iç iş yayınlanabilir; onay kararı yalnızca aktif yöneticiye aittir", () => {
    const id=task();
    assert.throws(()=>updateTaskStatus(id,"Onaylandi","member"),/yöneticiler/);
    updateTaskStatus(id,"Onaylandi","manager");
    updateTaskStatus(id,"Yayinlandi","member");
    assert.ok(getTask(id)?.completed_at);
  });

  it("üye teslimi onaylayamaz; aktif revize onayı engeller ve karar değişmeden kalır", () => {
    const id=task(), delivery=submit(id);
    assert.throws(()=>decideTaskDelivery({ deliveryId:delivery.id, decision:"Onaylandi", actorKind:"team", actorAccountId:"tu", actorPersonId:"member", actorName:"Üye",decisionNote:null,revisionReason:null,revisionTargetMinutes:null }),/yöneticiler/);
    const revision=startTaskRevision({taskId:id,targetMinutes:60,note:"Kontrol",actorId:"manager"});
    assert.throws(()=>approve(delivery.id),/aktif revize/);
    assert.equal(listTaskDeliveries(id)[0].status,"Beklemede");
    completeTaskRevision(revision.id,"member"); approve(delivery.id);
  });

  it("V2 müşteri onayı V1 revizeyi değiştirmez; eski karar ve yanlış hesap tekrarları etkisizdir", () => {
    const id=task(); getDb().prepare("UPDATE tasks SET origin='guest' WHERE id=?").run(id);
    const v1=submit(id,true);
    decideTaskDelivery({deliveryId:v1.id,decision:"RevizeIstendi",actorKind:"guest",actorAccountId:"g",actorPersonId:null,actorName:"Müşteri",brandId:"b",decisionNote:"Metni düzelt",revisionReason:"Metin",revisionTargetMinutes:60});
    const active = getDb().prepare("SELECT id FROM task_revision_rounds WHERE task_id=? AND completed_at IS NULL").get(id) as {id:string};
    completeTaskRevision(active.id,"member");
    assert.throws(()=>updateTaskStatus(id,"Yayinlandi","manager"),/son teslim/);
    const v2=submit(id,true);
    const decision={deliveryId:v2.id,decision:"Onaylandi" as const,actorKind:"guest" as const,actorAccountId:"g",actorPersonId:null,actorName:"Müşteri",brandId:"b",decisionNote:null,revisionReason:null,revisionTargetMinutes:null};
    assert.throws(()=>decideTaskDelivery({...decision,actorAccountId:"bad"}),/yetkiniz/);
    decideTaskDelivery(decision);
    assert.throws(()=>decideTaskDelivery({...decision,deliveryId:v1.id}),/daha önce/);
    assert.throws(()=>decideTaskDelivery(decision),/daha önce/);
    assert.deepEqual(listTaskDeliveries(id).map(d=>d.status),["Onaylandi","RevizeIstendi"]);
    updateTaskStatus(id,"Yayinlandi","member");
  });

  it("iki gerçek süreç eşzamanlı yayınladığında tek olay ve tek ardıl oluşur", {timeout:20000}, async () => {
    const id=task();
    const code=`import {getDb} from './lib/db/client.ts'; import {updateTaskStatus} from './lib/repositories/tasks.ts'; getDb(); process.send('ready'); process.on('message',()=>{try { process.send({changed:updateTaskStatus(${JSON.stringify(id)},'Yayinlandi','member')}); process.exit(0); } catch(e) {console.error(e);process.exit(1);} });`;
    const children=[0,1].map(()=>spawn(process.execPath,["--import","./scripts/register.mjs","--input-type=module","-e",code],{cwd:process.cwd(),env:{...process.env,INTURLAM_DB_PATH:dbPath},stdio:["ignore","ignore","pipe","ipc"]}));
    try {
      const exits=children.map(child=>new Promise<void>((resolve,reject)=>{let stderr="";child.stderr?.on("data",s=>stderr+=s);child.on("error",reject);child.on("exit",code=>code===0?resolve():reject(new Error(stderr)));}));
      await Promise.all(children.map(child=>new Promise<void>((resolve,reject)=>{child.once("message",()=>resolve());child.once("error",reject);})));
      children.forEach(child=>child.send("go")); await Promise.all(exits);
      assert.equal((getDb().prepare("SELECT COUNT(*) n FROM task_recurrence_occurrences WHERE source_task_id=?").get(id) as {n:number}).n,1);
      assert.equal((getDb().prepare("SELECT COUNT(*) n FROM task_status_events WHERE task_id=?").get(id) as {n:number}).n,1);
    } finally {children.forEach(child=>child.kill());}
  });
});
