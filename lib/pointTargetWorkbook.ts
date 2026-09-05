import { departmentLabel } from "@/lib/departments";
import type { PersonPointTargetRow } from "@/lib/repositories/monthlyPointTargets";
import type { Sheet } from "@/lib/xlsx";

export function buildPointTargetSheet(rows: PersonPointTargetRow[]): Sheet {
  return {
    name: "Aylık kişisel hedefler",
    columns: ["Ay", "Kişi", "Departman", "Hedef puan", "Kazanılan katkı puanı", "Atanan iş puanı", "Gerçekleşme (%)", "Kalan puan", "Hedef üzeri puan", "Hedef durumu", "Hesaplama"].map(header => ({ header })),
    rows: rows.map(row => [row.month, row.person_name, departmentLabel(row.department), row.target_points, row.earned_points, row.assigned_points,
      row.percent, row.remaining_points, row.extra_points, row.target_points === null ? "Hedef tanımlanmadı" : row.remaining_points === 0 ? "Hedef tamamlandı" : "Devam ediyor",
      "İç teslim ayı ve görev durum katsayısına göre katkı"]),
  };
}
