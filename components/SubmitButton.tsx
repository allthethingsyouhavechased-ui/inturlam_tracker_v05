"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/Button";

export default function SubmitButton({
  children,
  className,
  pendingLabel = "Kaydediliyor…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      className={className ?? buttonClass({ className: "font-semibold" })}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
