// Rapor ekranının Excel dökümü:
// /reports/export?range=month[&start&end][&person=ID | &department=ID]
//
// Neden Server Action değil de route handler: dosya indirmesi bir HTTP yanıtı —
// tarayıcı `<a download>` ile doğrudan çekiyor, JavaScript'te blob kurmaya
// (`downloadCSV`in yaptığı gibi) gerek kalmıyor. Ayrıca `lib/xlsx.ts`
// `node:zlib` kullanıyor; burada kalınca istemci paketine hiç girmiyor.

import { NextResponse } from "next/server";
import { assertTargetMonth } from "@/lib/monthlyPointTargets";
import { buildPointTargetSheet } from "@/lib/pointTargetWorkbook";
import { getPersonPointTargetProgress, listMonthlyPointTargets } from "@/lib/repositories/monthlyPointTargets";
import { getCurrentPerson } from "@/lib/identity";
import { currentMonthRange, currentWeekRange, todayISO } from "@/lib/date";
import {
  departmentKey,
  departmentLabel,
  isDepartmentId,
  NO_DEPARTMENT,
  type DepartmentKey,
} from "@/lib/departments";
import { buildReportSheets } from "@/lib/reportWorkbook";
import { clusterLabelMap } from "@/lib/repositories/clusters";
import { getPerson } from "@/lib/repositories/people";
import {
  getCycleTimeReport,
  getReportSummary,
  getTrendReport,
  listBrandReport,
  listDepartmentReport,
  listDueHealthReport,
  listPersonReport,
  listTaskDetailReport,
  listWorkflowReport,
  type DateRange,
  type ReportScope,
} from "@/lib/repositories/reports";
import { sweepArchivablePublishedTasks } from "@/lib/repositories/tasks";
import { buildXlsx, xlsxFileName } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Rapor sayfalarındaki `resolveRange` ile aynı kurallar; burada ayrıca elle
// yazılmış query string'e karşı tarih biçimi doğrulanıyor (bozuk değer sessizce
// "tüm zamanlar"a düşsün, 500 üretmesin).
function resolveRange(params: URLSearchParams): { range: DateRange | null; key: string } {
  const key = params.get("range") ?? "all";
  if (key === "week") return { range: currentWeekRange(), key };
  if (key === "month") return { range: currentMonthRange(), key };
  if (key === "custom") {
    const start = params.get("start") ?? "";
    const end = params.get("end") ?? "";
    if (ISO_DATE.test(start) && ISO_DATE.test(end) && start <= end) {
      return { range: { start, end }, key };
    }
  }
  return { range: null, key: "all" };
}

function shiftISODate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousDateRange(range: DateRange): DateRange {
  const start = new Date(`${range.start}T12:00:00`);
  const end = new Date(`${range.end}T12:00:00`);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = shiftISODate(range.start, -1);
  return { start: shiftISODate(previousEnd, -(dayCount - 1)), end: previousEnd };
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export async function GET(request: Request): Promise<NextResponse> {
  const currentPerson = await getCurrentPerson();
  if (!currentPerson) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }
  if (currentPerson.is_manager !== 1) {
    return NextResponse.json({ error: "Bu rapora erişim yetkin yok." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const { range } = resolveRange(params);
  const today = todayISO();

  // Kapsam: geçersiz/bilinmeyen id sessizce portföy geneline düşmemeli —
  // dosyayı açan kişi hangi kapsama baktığını bilmelidir.
  const personId = params.get("person");
  const person = personId ? getPerson(personId) : undefined;
  if (personId && !person) {
    return NextResponse.json({ error: "Kişi bulunamadı." }, { status: 404 });
  }

  const departmentParam = params.get("department");
  if (departmentParam && !isDepartmentId(departmentParam) && departmentParam !== NO_DEPARTMENT) {
    return NextResponse.json({ error: "Departman bulunamadı." }, { status: 404 });
  }
  const department = departmentParam ? (departmentParam as DepartmentKey) : null;

  // Kişi kapsamı departmandan önce gelir: ikisi birden verilirse dosya tek bir
  // şeyi anlatmalı, kişi daha dar olan.
  const scope: ReportScope = person?.id ?? (department ? { department } : null);

  if (params.get("view") === "targets") {
    let month: string;
    try { month = assertTargetMonth(params.get("month") ?? today.slice(0, 7)); }
    catch { return NextResponse.json({ error: "Geçerli bir hedef ayı seçin." }, { status: 400 }); }
    const rows = person ? [{ person_id: person.id, person_name: person.name, active: person.active, department: person.department, ...getPersonPointTargetProgress(person.id, month) }]
      : listMonthlyPointTargets(month).filter(row => !department || departmentKey(row.department) === department);
    const fileName = xlsxFileName([person?.name ?? department ?? "ekip", "aylik-hedefler", month]);
    return new NextResponse(new Uint8Array(buildXlsx([buildPointTargetSheet(rows)])), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    } });
  }

  // Döküm de panolarla aynı arşiv kuralını görsün.
  sweepArchivablePublishedTasks();

  const reportLabel = range
    ? `${formatReportDate(range.start)} – ${formatReportDate(range.end)}`
    : "Tüm zamanlar";

  const scopeTitle = person
    ? `Kişi raporu · ${person.name}`
    : department
      ? `Departman raporu · ${departmentLabel(department)}`
      : "Portföy geneli";

  const sheets = buildReportSheets({
    title: scopeTitle,
    reportLabel,
    generatedAt: new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date()),
    summary: getReportSummary(range, today, scope),
    previousSummary: range ? getReportSummary(previousDateRange(range), today, scope) : null,
    workflow: listWorkflowReport(scope),
    dueHealth: listDueHealthReport(today, scope),
    cycleTime: getCycleTimeReport(range, scope),
    trend: getTrendReport(range, scope),
    tasks: listTaskDetailReport(range, today, scope),
    // Kişi dosyasında ekip tablosu yok (o kişiyi ekiple kıyaslamak raporun kendi
    // ekranının işi); departman dosyasında ekip tablosu YALNIZCA o departmanın
    // kişilerini taşır — "yük kimde" sorusu departman raporunun asıl sorusu.
    people: person
      ? []
      : department
        ? listPersonReport(range, today).filter(
            (row) => departmentKey(row.department) === department,
          )
        : listPersonReport(range, today),
    // Marka ve departman tabloları yalnızca portföy dosyasında: kapsamlı
    // dosyada ikisi de kapsamın kendisini tekrar ederdi.
    brands: person || department ? [] : listBrandReport(range, today),
    departments: person || department ? [] : listDepartmentReport(range, today),
    clusterLabels: clusterLabelMap(),
  });

  const fileName = xlsxFileName([
    person ? person.name : department ? `${departmentLabel(department)}-departmani` : "inturlam",
    "rapor",
    range ? `${range.start}_${range.end}` : "tum-zamanlar",
  ]);

  return new NextResponse(new Uint8Array(buildXlsx(sheets)), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // İç araç, LAN: tarayıcı eski bir dökümü yeniden sunmasın.
      "Cache-Control": "no-store",
    },
  });
}
