import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";

// @dnd-kit kendi varsayılan duyurularını İNGİLİZCE üretir ("Draggable item 3 was
// moved over droppable area 2"). Arayüzün tamamı Türkçe olduğu için ekran
// okuyucu kullanan biri sürükleme sırasında dilin değiştiğini duyuyordu; üstelik
// varsayılan metin görevin adını değil ham id'sini okuyor.
//
// İki panonun (`TaskBoard`, `KanbanBoard`) ayrı ayrı kendi metnini yazmaması
// için duyurular TEK yerde: pano yalnızca "bu id'nin adı ne" ve "bu sütunun
// etiketi ne" sorularını cevaplayan iki fonksiyon geçirir.
export const TASK_DRAG_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Görevi taşımak için boşluk veya enter tuşuna basın. Sürükleme başladıktan sonra "
    + "yön tuşlarıyla sütunlar arasında gezinin. Bırakmak için tekrar boşluk veya enter, "
    + "vazgeçmek için escape tuşuna basın.",
};

export interface TaskDragLabels {
  /** Sürüklenen görevin okunabilir adı. Bulunamazsa boş string dönmeli. */
  readonly taskName: (taskId: string) => string;
  /** Üzerine gelinen sütunun (durumun) okunabilir etiketi. */
  readonly columnLabel: (columnId: string) => string;
}

function nameOf(labels: TaskDragLabels, id: unknown): string {
  const name = labels.taskName(String(id)).trim();
  return name.length > 0 ? name : "Görev";
}

export function taskDragAnnouncements(labels: TaskDragLabels): Announcements {
  return {
    onDragStart({ active }) {
      return `${nameOf(labels, active.id)} alındı.`;
    },
    onDragOver({ active, over }) {
      if (!over) return `${nameOf(labels, active.id)} bir sütunun dışında.`;
      return `${nameOf(labels, active.id)} şimdi ${labels.columnLabel(String(over.id))} sütununun üzerinde.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `${nameOf(labels, active.id)} bırakıldı, durumu değişmedi.`;
      return `${nameOf(labels, active.id)} ${labels.columnLabel(String(over.id))} sütununa taşındı.`;
    },
    onDragCancel({ active }) {
      return `${nameOf(labels, active.id)} taşıması iptal edildi, görev eski durumunda kaldı.`;
    },
  };
}
