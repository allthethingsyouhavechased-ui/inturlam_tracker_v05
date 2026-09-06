"use client";

import { useState, type ReactNode } from "react";
import PageActionDialog from "@/components/ui/PageActionDialog";

export default function ContentTaskCreateDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <PageActionDialog open={open} onOpenChange={setOpen} triggerLabel="Görev oluştur" title="Görev oluştur"
    description="Tek görev ekle veya standart bir iş akışını şablondan getir.">
    <div className="space-y-5">{children}</div>
  </PageActionDialog>;
}
