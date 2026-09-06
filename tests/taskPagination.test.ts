import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, it } from "node:test";
import { EMPTY_TASK_FILTERS, parseTaskFilterParams } from "@/lib/taskFilterParams";
import { parseTaskPage, parseTaskListSort, taskPageHref } from "@/lib/taskPagination";
import { readTaskListReturn, restoreTaskListScroll } from "@/lib/taskListNavigation";

const dbPath = path.join(os.tmpdir(), `inturlam-task-pagination-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = dbPath;
const { getDb } = await import("@/lib/db/client");
const { listTaskPage, listPlanningPage } = await import("@/lib/repositories/taskListing");
const options = { today: "2026-09-06", weekEnd: "2026-09-13" };
function clean() {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true });
}
beforeEach(() => {
  clean();
  getDb().exec("INSERT INTO people(id,name,is_manager,department) VALUES('manager','Yönetici',1,'management'),('member','Üye',0,'video'); INSERT INTO brands(id,name,cluster) VALUES('brand','Marka','tek'),('other','Diğer','tek'); INSERT INTO content_items(id,brand_id,title,type) VALUES('content','brand','İçerik','Reel'),('other-content','other','Başka','Reel')");
});
after(clean);
function seed(count: number) {
  const db = getDb();
  const insert = db.prepare("INSERT INTO tasks(id,content_item_id,title,weight_points,status,due_date,assignee_id,notes) VALUES(?,'content',?,?,'DevamEdiyor','2026-09-10',?,?)");
  db.exec("BEGIN");
  for (let i=0;i<count;i++) insert.run(`task-${String(i).padStart(5,"0")}`,`İş ${String(i).padStart(5,"0")}`, i%100+1, i%2 ? 'member' : 'manager', "Uzun not ".repeat(200));
  db.exec("COMMIT");
}
for (const count of [2000,10000]) it(`${count} tasks: 50 row bound and payload budget`, () => {
  seed(count);
  const started = performance.now();
  const first = listTaskPage("member",EMPTY_TASK_FILTERS,options);
  const ms = performance.now()-started;
  assert.equal(first.tasks.length,50); assert.equal(first.total,count);
  assert.equal(first.pages,count/50);
  const bytes=Buffer.byteLength(JSON.stringify(first));
  assert.ok(bytes<500000,`Payload: ${bytes}`);
  assert.ok(first.tasks.every(t => t.notes===null && t.guest_brief===null));
  const second = listTaskPage("member",EMPTY_TASK_FILTERS,{...options,page:2});
  assert.equal(new Set([...first.tasks,...second.tasks].map(t=>t.id)).size,100);
  assert.deepEqual(listTaskPage("member",EMPTY_TASK_FILTERS,options).tasks.map(t=>t.id),first.tasks.map(t=>t.id));
  console.info(JSON.stringify({benchmark:"task-page",count,rows:first.tasks.length,bytes,ms:Math.round(ms*100)/100,node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model}));
});
it("every filtered page and department count uses the same scope and stable order", () => {
  seed(203);
  const filter={...EMPTY_TASK_FILTERS,department:"video",pointsMin:"20",pointsMax:"80"};
  const result=listTaskPage("member",filter,{...options,sort:{key:"puan",dir:"asc"}});
  const ids:string[]=[]; const points:number[]=[];
  for(let page=1;page<=result.pages;page++) {
    const slice=listTaskPage("member",filter,{...options,page,sort:{key:"puan",dir:"asc"}});
    assert.equal(slice.total,result.total);
    assert.equal(slice.departmentCounts.video,result.total);
    for (const task of slice.tasks) { assert.equal(task.assignee_id,"member");ids.push(task.id);points.push(task.weight_points); }
  }
  assert.equal(ids.length,result.total); assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(points,[...points].sort((a,b)=>b-a));
  assert.equal(listTaskPage("member",filter,{...options,page:999}).page,result.pages);
});
it("SQL parameters and Turkish search cannot expand a filtered result", () => {
  seed(3);
  assert.equal(listTaskPage("member",{...EMPTY_TASK_FILTERS,q:"İŞ"},options).total,3);
  for(const value of ["' OR 1=1 --","%","_"]) assert.equal(listTaskPage("member",{...EMPTY_TASK_FILTERS,q:value},options).total,0);
  assert.equal(listTaskPage("member",{...EMPTY_TASK_FILTERS,brand:"' OR 1=1 --"},options).total,0);
});
it("every page requires active team identity and personal target belongs only to viewer", () => {
  seed(103);
  getDb().exec("INSERT INTO task_personal_targets(task_id,person_id,target_date) VALUES('task-00001','member','2026-09-08')");
  assert.equal(listTaskPage("member",EMPTY_TASK_FILTERS,options).tasks.find(t=>t.id==='task-00001')?.personal_target_date,'2026-09-08');
  assert.equal(listTaskPage("manager",EMPTY_TASK_FILTERS,options).tasks.find(t=>t.id==='task-00001')?.personal_target_date,null);
  for(const actor of ["","guest","missing"]) for(const page of [1,2,3]) assert.throws(()=>listTaskPage(actor,EMPTY_TASK_FILTERS,{...options,page}));
  getDb().exec("UPDATE people SET active=0 WHERE id='member'");
  assert.throws(()=>listTaskPage("member",EMPTY_TASK_FILTERS,{...options,page:2}));
});
it("unplanned customer requests and archived tasks stay outside operational pages", () => {
  seed(3);
  getDb().exec("UPDATE tasks SET origin='guest',due_date=NULL WHERE id='task-00000'; UPDATE tasks SET archived_at='2026-09-01' WHERE id='task-00001'; UPDATE tasks SET due_date=NULL WHERE id='task-00002'");
  assert.deepEqual(listTaskPage("member",EMPTY_TASK_FILTERS,options).tasks.map(t=>t.id),['task-00002']);
  assert.equal(listPlanningPage('member').total,1); assert.equal(listPlanningPage('manager').total,2);
  assert.throws(()=>listPlanningPage('guest'));
});
it("page, column and filter URL roundtrip preserves detail return context", () => {
  const filters={...EMPTY_TASK_FILTERS,brand:'brand',q:'İş & ekip',department:'video',from:'2026-09-01',to:'2026-09-30'};
  const href=taskPageHref(filters,3,{key:'puan',dir:'desc'});
  const query=new URL(href,'http://localhost').searchParams;
  assert.deepEqual(parseTaskFilterParams(Object.fromEntries(query)),filters);
  assert.equal(parseTaskPage(query.get('page')!),3);
  assert.deepEqual(parseTaskListSort(query.get('column')!,query.get('dir')!),{key:'puan',dir:'desc'});
  for(const value of ['-1','0','abc','1.5','Infinity']) assert.equal(parseTaskPage(value),1);
  assert.equal(parseTaskListSort('DROP TABLE tasks','desc'),null);
});
it("return link accepts only task list paths and restores exact list scroll", (context) => {
  const stored={href:'/tasks?brand=brand&page=3&column=puan&dir=desc',scroll:640,taskPath:'/tasks/task-00001'};
  const descriptors=new Map(['sessionStorage','window','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  context.after(()=>{for(const [key,value] of descriptors) { if(value) Object.defineProperty(globalThis,key,value); else Reflect.deleteProperty(globalThis,key); }});
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>JSON.stringify(stored)}});
  let position=0;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{pathname:'/tasks',search:stored.href.slice(6)},scrollTo:(_x:number,y:number)=>{position=y;}}});
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:()=>void)=>{fn(); return 1;}});
  Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:()=>{}});
  assert.equal(readTaskListReturn()?.href,stored.href);
  restoreTaskListScroll(); assert.equal(position,640);
  stored.href='/tasks?page=1'; stored.scroll=100;
  restoreTaskListScroll(); assert.equal(position,640);
  stored.href='https://attacker.invalid/tasks'; assert.equal(readTaskListReturn(),null);
});
