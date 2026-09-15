"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { ActionResult } from "@/lib/actionResult";

type ActionReturn = string | void | ActionResult<string | undefined>;

function isActionResult(value: unknown): value is ActionResult<string | undefined> {
  return Boolean(value) && typeof value === "object" && "ok" in (value as object);
}

export default function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  redirectPathPrefix,
  feedbackClassName,
  warnOnUnsavedChanges = false,
}: {
  action: (formData: FormData) => Promise<ActionReturn>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  redirectPathPrefix?: string;
  feedbackClassName?: string;
  /** Kaydedilmemiş değişiklik varken sayfadan çıkışta tarayıcı uyarısı ver. */
  warnOnUnsavedChanges?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<boolean>(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Uyarı yalnızca gerçekten bir alan değiştiyse çıkar. `beforeunload` sekme
  // kapatma/yenileme ve dış bağlantıları kapsıyor; uygulama içi yönlendirmede
  // kullanıcı zaten aynı sayfada kalıyor (App Router gezinmesi formu sökmüyor).
  useEffect(() => {
    if (!warnOnUnsavedChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [warnOnUnsavedChanges]);

  return (
    <form
      ref={formRef}
      onInput={warnOnUnsavedChanges ? () => { dirtyRef.current = true; } : undefined}
      action={async (formData) => {
        setError(null);
        setConflict(false);
        setSuccess(null);
        try {
          const result = await action(formData);
          // Beklenen hatalar artık fırlatılmıyor, dönüş değeriyle geliyor —
          // üretimde fırlatılan hata React #441'e indirgeniyordu (actionResult.ts).
          if (isActionResult(result) && !result.ok) {
            setError(result.error);
            setConflict(result.code === "conflict");
            return;
          }
          const value = isActionResult(result) ? result.value : result;
          dirtyRef.current = false;
          if (resetOnSuccess) formRef.current?.reset();
          const doneMessage = (isActionResult(result) && result.message) || successMessage;
          if (doneMessage) setSuccess(doneMessage);
          if (redirectPathPrefix && typeof value === "string") {
            router.push(`${redirectPathPrefix}${encodeURIComponent(value)}`);
          }
        } catch (cause) {
          setError(getActionErrorMessage(cause));
        }
      }}
      className={className}
    >
      {children}
      {error && (
        <p role="alert" className={`${feedbackClassName ?? ""} text-xs text-danger`}>
          {error}
          {conflict && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => router.refresh()}
                className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                Güncel hâli yükle
              </button>
            </>
          )}
        </p>
      )}
      {success && <p role="status" aria-live="polite" className={`${feedbackClassName ?? ""} text-xs text-success`}>{success}</p>}
    </form>
  );
}
