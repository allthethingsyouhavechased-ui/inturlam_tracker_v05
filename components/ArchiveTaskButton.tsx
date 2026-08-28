"use client";

import { useTransition } from "react";
import Button from "@/components/ui/Button";
import { restoreArchivedTaskAction, setTaskArchivedAction } from "@/lib/actions/tasks";

// Görev arşivi bir SİLME değil, "panodan çek" düğmesi — bu yüzden arşivlerken
// onay sorulmuyor (ArchiveContentButton'ın aksine): geri alma tek tık ve görev
// hiçbir listeden kalıcı olarak kaybolmuyor.
//
// Düğme artık YALNIZCA yayınlanmış işte değil, her durumda görünüyor: açık bir
// işi "bu iş yapılmayacak" diye panodan çekmenin başka yolu yoktu, tek seçenek
// kalıcı silmekti. Yayınlanmamış bir işte etiket "Görevi iptal et" oluyor;
// altındaki eylem aynı (arşive al), çünkü kayıt korunmalı.
export default function ArchiveTaskButton({
  taskId,
  archived,
  published = false,
}: {
  taskId: string;
  archived: boolean;
  published?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const label = archived ? "Yeniden aç" : published ? "Arşivle" : "Görevi iptal et";

  return (
    <Button
      type="button"
      disabled={pending}
      title={archived
        ? "Görevi arşivden çıkar"
        : "Görevi listelerden çek — kayıt silinmez, tek tıkla geri alınır"}
      onClick={() => startTransition(() => archived
        ? restoreArchivedTaskAction(taskId)
        : setTaskArchivedAction(taskId, true))}
      variant="secondary"
    >
      {pending ? "…" : label}
    </Button>
  );
}
