"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getActionErrorMessage } from "@/lib/errorMessage";

type ActionResult = string | void;

export default function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  redirectPathPrefix,
  feedbackClassName,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  redirectPathPrefix?: string;
  feedbackClassName?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setError(null);
        setSuccess(null);
        try {
          const result = await action(formData);
          if (resetOnSuccess) formRef.current?.reset();
          if (successMessage) setSuccess(successMessage);
          if (redirectPathPrefix && typeof result === "string") {
            router.push(`${redirectPathPrefix}${encodeURIComponent(result)}`);
          }
        } catch (cause) {
          setError(getActionErrorMessage(cause));
        }
      }}
      className={className}
    >
      {children}
      {error && <p role="alert" className={`${feedbackClassName ?? ""} text-xs text-danger`}>{error}</p>}
      {success && <p role="status" aria-live="polite" className={`${feedbackClassName ?? ""} text-xs text-emerald-700 dark:text-emerald-300`}>{success}</p>}
    </form>
  );
}
