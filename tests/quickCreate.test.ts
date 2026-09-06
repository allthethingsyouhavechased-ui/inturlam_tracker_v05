import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { after, beforeEach, describe, it } from "node:test";
import { quickCreateDefaults, QuickCreateValidationError } from "@/lib/quickCreate";

const dbPath = path.join(os.tmpdir(), `inturlam-quick-create-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = dbPath;
const { getDb } = await import("@/lib/db/client");
const { quickCreateTask } = await import("@/lib/repositories/quickCreate");
function reset() {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true });
}
beforeEach(() => {
  reset();
  getDb().exec("INSERT INTO people(id,name,is_manager) VALUES('manager','Manager',1),('member','Member',0); INSERT INTO brands(id,name,cluster) VALUES('brand','Brand','tek'),('other','Other','tek')");
});
after(reset);
function input(changes: Record<string,string> = {}) {
  const data = new FormData();
  for (const [key,value] of Object.entries({ requestId: 'request-0123456789', brandId: 'brand', contentItemId: '__new__', newContentTitle: '', title: 'New task', contentType: 'Reel', priority: 'Normal', difficulty: 'Orta', weightPoints: '', assigneeId: 'member', dueDate: '2026-09-10', ...changes })) data.set(key,value);
  return data;
}
function count(table: string) { return Number((getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n:number}).n); }
function untouched() { assert.equal(count('content_items'),0); assert.equal(count('tasks'),0); assert.equal(count('quick_create_requests'),0); }
function fieldError(data: FormData, field: string, actor='manager') {
  assert.throws(() => quickCreateTask(actor,data), (error: unknown) => error instanceof QuickCreateValidationError && field in error.fieldErrors);
}

describe('atomic quick creation', () => {
  it('creates one content, task and receipt, and retry returns the same IDs', () => {
    const first = quickCreateTask('manager', input());
    assert.deepEqual(quickCreateTask('manager',input()), first);
    assert.equal(count('content_items'),1); assert.equal(count('tasks'),1); assert.equal(count('quick_create_requests'),1); assert.equal(count('activity_log'),1);
    assert.equal((getDb().prepare('SELECT weight_points FROM tasks').get() as {weight_points:number}).weight_points,2);
  });
  it('validates real dates before any content is inserted', () => {
    for (const dueDate of ['', '2026-02-29', '2026-13-01', '2026-04-31', '2026-9-01']) { fieldError(input({dueDate}), 'dueDate'); untouched(); }
    quickCreateTask('manager',input({dueDate:'2028-02-29'})); assert.equal(count('tasks'),1);
  });
  it('rejects deleted or inactive assignee and preserves both counts', () => {
    fieldError(input({assigneeId:'missing'}),'assigneeId'); untouched();
    getDb().exec("UPDATE people SET active=0 WHERE id='member'"); fieldError(input(),'assigneeId'); untouched();
  });
  it('rolls back new content when the task insert fails, then allows the same request to retry', () => {
    getDb().exec("CREATE TRIGGER fail_quick_task BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT, 'simulated disk write failure'); END");
    assert.throws(() => quickCreateTask('manager',input()), /simulated/); untouched();
    getDb().exec('DROP TRIGGER fail_quick_task'); quickCreateTask('manager',input()); assert.equal(count('tasks'),1);
  });
  it('rolls back the entire write when the receipt cannot be inserted', () => {
    getDb().exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON quick_create_requests BEGIN SELECT RAISE(ABORT, 'receipt failure'); END");
    assert.throws(() => quickCreateTask('manager',input()), /receipt failure/); untouched();
  });
  it('existing content must belong to the selected brand and be open', () => {
    getDb().exec("INSERT INTO content_items(id,brand_id,title,type) VALUES('existing','other','Existing','Reel')");
    fieldError(input({contentItemId:'existing'}),'contentItemId'); assert.equal(count('tasks'),0);
    getDb().exec("UPDATE content_items SET brand_id='brand', status='IptalEdildi' WHERE id='existing'");
    fieldError(input({contentItemId:'existing'}),'contentItemId');
    getDb().exec("UPDATE content_items SET status='Planlandi' WHERE id='existing'");
    quickCreateTask('manager', input({contentItemId:'existing'})); assert.equal(count('content_items'),1); assert.equal(count('tasks'),1);
  });
  it('reports all invalid fields together, without changing data', () => {
    assert.throws(() => quickCreateTask('manager',input({title:'',brandId:'missing',contentType:'bogus',priority:'bogus',difficulty:'bogus'})), (error: unknown) => {
      assert.ok(error instanceof QuickCreateValidationError);
      for (const field of ['title','brandId','contentType','priority','difficulty']) assert.ok(field in error.fieldErrors);
      return true;
    }); untouched();
  });
  it('enforces weight permissions from the current actor record', () => {
    fieldError(input({weightPoints:'50'}),'weightPoints','member'); untouched();
    quickCreateTask('member',input()); assert.equal(count('tasks'),1);
  });
  it('rejects unknown and inactive actors', () => {
    assert.throws(() => quickCreateTask('unknown', input()), /Aktif ekip/);
    getDb().exec("UPDATE people SET active=0 WHERE id='manager'");
    assert.throws(() => quickCreateTask('manager', input()), /Aktif ekip/); untouched();
  });
  it('rejects changed payload reuse and never recreates a deleted task', () => {
    const first=quickCreateTask('manager', input());
    assert.throws(() => quickCreateTask('manager',input({title:'Changed'})), /daha önce kaydedildi/);
    getDb().prepare('DELETE FROM tasks WHERE id = ?').run(first.taskId);
    assert.throws(() => quickCreateTask('manager',input()), /silinmiş/);
    assert.equal(count('tasks'),0); assert.equal(count('content_items'),1);
  });
  it('initial and reset defaults both produce the difficulty-based points', () => {
    for (let n=0; n<2; n++) {
      const defaults=quickCreateDefaults('member','2026-09-10');
      assert.equal(defaults.weightPoints,'');
      quickCreateTask('manager',input({requestId:`different-request-${n}`, difficulty:defaults.difficulty, weightPoints:defaults.weightPoints}));
    }
    assert.deepEqual(getDb().prepare('SELECT weight_points FROM tasks').all().map(row=>row.weight_points),[2,2]);
  });
  it('two independent concurrent requests return exactly the same task', async () => {
    const execute=promisify(execFile);
    const fields=Array.from(input().entries());
    const script=`const {quickCreateTask}=await import('./lib/repositories/quickCreate.ts'); const data=new FormData(); for(const [k,v] of ${JSON.stringify(fields)}) data.set(k,v); console.log(JSON.stringify(quickCreateTask('manager',data)));`;
    const args=['--import','./scripts/register.mjs','--input-type=module','-e',script];
    const results=await Promise.all([execute(process.execPath,args),execute(process.execPath,args)]);
    assert.equal(results[0].stdout.trim(),results[1].stdout.trim());
    assert.equal(count('content_items'),1); assert.equal(count('tasks'),1); assert.equal(count('quick_create_requests'),1);
  });
});
