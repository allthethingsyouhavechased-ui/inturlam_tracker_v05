import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {after,it} from 'node:test';
import {drilldownRange,parseReportMetric,reportMetricRows} from '@/lib/reportDrilldown';
const dbPath=path.join(os.tmpdir(),`inturlam-report-drilldown-${process.pid}.db`);
process.env.INTURLAM_DB_PATH=dbPath;
const {getDb}=await import('@/lib/db/client');
const {getReportSummary,listTaskDetailReport}=await import('@/lib/repositories/reports');
after(()=>{globalThis.__inturlamDb?.close();globalThis.__inturlamDb=undefined;for(const suffix of ['','-wal','-shm']) fs.rmSync(dbPath+suffix,{force:true});});
it('four report metric drilldowns match summary counts across date boundaries',()=>{
  const db=getDb();
  db.exec("INSERT INTO brands(id,name,cluster) VALUES('b','Marka','tek'); INSERT INTO content_items(id,brand_id,title,type) VALUES('c','b','İçerik','Reel')");
  const insert=db.prepare("INSERT INTO tasks(id,content_item_id,title,status,created_at,completed_at,due_date) VALUES(?,'c',?,?,?,?,?)");
  insert.run('old-open','Önceki aydan açık','DevamEdiyor','2026-08-20',null,'2026-09-01');
  insert.run('new-open','Yeni','Beklemede','2026-09-01',null,'2026-09-30');
  insert.run('done','Tamamlandı','Yayinlandi','2026-08-25','2026-09-03','2026-09-02');
  insert.run('old-done','Eski tamamlandı','Yayinlandi','2026-08-01','2026-08-02','2026-08-02');
  for(const range of [null,{start:'2026-09-01',end:'2026-09-30'}]) {
    const summary=getReportSummary(range,'2026-09-06');
    const rows=listTaskDetailReport(range,'2026-09-06');
    for(const [metric,key] of [['opened','opened_tasks'],['completed','completed_tasks'],['open','open_tasks'],['overdue','overdue_tasks']] as const) {
      const filtered=reportMetricRows(rows,metric);
      assert.equal(filtered.length,summary[key]);
      assert.equal(new Set(filtered.map(row=>row.task_id)).size,filtered.length);
    }
  }
});
it('custom report boundaries reject impossible dates instead of silently expanding scope',()=>{
  for(const [start,end] of [['2026-02-30','2026-03-01'],['2026-13-01','2026-13-02'],['2026-09-30','2026-09-01']]) assert.throws(()=>drilldownRange(new URLSearchParams({range:'custom',start,end})));
  assert.deepEqual(drilldownRange(new URLSearchParams({range:'custom',start:'2024-02-29',end:'2024-03-01'})),{start:'2024-02-29',end:'2024-03-01'});
  assert.throws(()=>parseReportMetric('constructor'));assert.throws(()=>parseReportMetric(null));
});
