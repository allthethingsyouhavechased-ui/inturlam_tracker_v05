import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { matchesPersonalFocus, personalFocusCounts } from "@/lib/workQueues";
import type { TaskWithContext } from "@/lib/types";

const dbPath = path.join(os.tmpdir(), `inturlam-work-queues-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = dbPath;
const { getDb } = await import("@/lib/db/client");
const { listPendingDecisions } = await import("@/lib/repositories/decisionQueue");
function reset() {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true });
}
beforeEach(() => {
  reset();
  getDb().exec(`INSERT INTO people(id,name,is_manager) VALUES('manager','Manager',1),('member','Member',0);
    INSERT INTO brands(id,name,cluster) VALUES('brand','Brand','tek');
    INSERT INTO content_items(id,brand_id,title,type) VALUES('content','brand','Content','Reel');
    INSERT INTO tasks(id,content_item_id,title,assignee_id,due_date,status) VALUES('task','content','Work','member','2026-09-06','Incelemede');
    INSERT INTO task_deliveries(id,task_id,version_number,submitted_by_name) VALUES('delivery','task',1,'Member');`);
});
after(reset);

describe("personal and decision queues", () => {
  it("manager sees another person's exact pending version; members and unknown actors do not", () => {
    assert.deepEqual(listPendingDecisions('manager').map(row => [row.task_id,row.delivery_id,row.version_number]), [['task','delivery',1]]);
    assert.deepEqual(listPendingDecisions('member'), []);
    assert.deepEqual(listPendingDecisions('unknown'), []);
  });
  it("decided delivery leaves queue immediately and next version replaces it", () => {
    getDb().exec("UPDATE task_deliveries SET status='Onaylandi',decision_actor_kind='guest',decided_by_name='Client',decided_at=datetime('now') WHERE id='delivery'");
    assert.equal(listPendingDecisions('manager').length,0);
    getDb().exec("INSERT INTO task_deliveries(id,task_id,version_number,submitted_by_name) VALUES('v2','task',2,'Member')");
    assert.equal(listPendingDecisions('manager')[0].delivery_id,'v2');
  });
  it("archived work and inactive manager are excluded", () => {
    getDb().exec("UPDATE tasks SET archived_at=datetime('now')");
    assert.equal(listPendingDecisions('manager').length,0);
    getDb().exec("UPDATE tasks SET archived_at=NULL; UPDATE people SET active=0 WHERE id='manager'");
    assert.equal(listPendingDecisions('manager').length,0);
  });
  it("today, overdue and revision counters match their lists including month boundary", () => {
    const tasks = [
      {id:'a',due_date:'2026-09-06',status:'Beklemede'},
      {id:'b',due_date:'2026-08-31',status:'DevamEdiyor',active_revision_id:'r1'},
      {id:'c',due_date:'2026-09-06',status:'Incelemede'},
      {id:'d',due_date:'2026-09-01',status:'Yayinlandi'},
      {id:'e',due_date:'2026-09-01',status:'Beklemede',archived_at:'2026-09-05'},
    ].map(task => ({archived_at:null,active_revision_id:null,...task})) as TaskWithContext[];
    const counts = personalFocusCounts(tasks,'2026-09-06');
    assert.deepEqual(counts,{all:5,today:1,overdue:1,revision:1});
    assert.deepEqual(tasks.filter(task => matchesPersonalFocus(task,'today','2026-09-06')).map(task=>task.id),['a']);
    assert.deepEqual(tasks.filter(task => matchesPersonalFocus(task,'overdue','2026-09-06')).map(task=>task.id),['b']);
  });
});
