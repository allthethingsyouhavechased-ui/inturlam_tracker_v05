"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resubmitClientRequestAction } from "@/lib/actions/clientRequests";
import { buttonClass } from "@/components/ui/Button";

/**
 * Bilgi beklenen veya reddedilen talebi kuyruğa geri koyar. Eski metin, ekler
 * ve karar geçmişi KORUNUR — yeni bir talep kaydı açılmaz.
 */
export default function ResubmitClientRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await resubmitClientRequestAction(requestId);
            if (!result.ok) { setError(result.error); return; }
            router.refresh();
          });
        }}
        className={buttonClass({ variant: "secondary", className: "w-full" })}
      >
        {pending ? "Gönderiliyor…" : "Tekrar değerlendirmeye gönder"}
      </button>
      {error && <p role="alert" className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
