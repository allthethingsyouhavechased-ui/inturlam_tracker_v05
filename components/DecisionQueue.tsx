"use client";

import { useState } from "react";
import Link from "next/link";
import type { DecisionQueueItem } from "@/lib/repositories/decisionQueue";
import PageActionDialog from "@/components/ui/PageActionDialog";

export default function DecisionQueue({ items }: { items: DecisionQueueItem[] }) {
  const [open, setOpen] = useState(false);
  return <PageActionDialog open={open} onOpenChange={setOpen} title="Kararım beklenen teslimler"
    triggerLabel={<>Bekleyen onaylar <span className="tabular-nums text-brand-600 dark:text-brand-300">{items.length}</span></>}>
    {items.length === 0 ? <p className="px-4 pb-4 text-xs text-muted">Karar bekleyen teslim yok.</p> :
      <ul className="max-h-80 overflow-y-auto border-t border-border-subtle divide-y divide-border-subtle">
        {items.map((item) => <li key={item.delivery_id}>
          <Link href={`/tasks/${item.task_id}#delivery-${item.delivery_id}`} onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-surface-hover">
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted">{item.brand_name}</span></span>
            <span className="shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-300">V{item.version_number} · İncele →</span>
          </Link>
        </li>)}
      </ul>}
  </PageActionDialog>;
}
