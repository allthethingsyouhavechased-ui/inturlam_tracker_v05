"use client";

import { useRef, useState } from "react";
import { createPersonAction } from "@/lib/actions/people";
import { DEPARTMENTS, NO_DEPARTMENT_LABEL } from "@/lib/departments";
import { getActionErrorMessage } from "@/lib/errorMessage";
import SubmitButton from "./SubmitButton";

const inputClass =
  "min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-white/15 dark:bg-zinc-900";

export default function NewPersonForm({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        try {
          await createPersonAction(fd);
          ref.current?.reset();
          onSuccess?.();
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        İsim
        <input name="name" required placeholder="Örn. Ada Yılmaz" className={inputClass} />
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Departman
        <select name="department" defaultValue="" className={inputClass}>
          <option value="">{NO_DEPARTMENT_LABEL}</option>
          {DEPARTMENTS.map((department) => (
            <option key={department.id} value={department.id}>
              {department.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Şifre
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Şifre tekrar
        <input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <div className="sm:col-span-2 sm:flex sm:justify-end">
        <SubmitButton>Ekip üyesi ekle</SubmitButton>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 sm:col-span-2">{error}</p>}
    </form>
  );
}
