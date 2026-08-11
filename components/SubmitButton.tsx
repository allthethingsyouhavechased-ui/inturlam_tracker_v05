"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/Button";

export default function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? buttonClass({ className: "font-semibold" })}
    >
      {pending ? "…" : children}
    </button>
  );
}
