"use client";

import { useRef, useState } from "react";
import { controlClass } from "@/components/ui/Input";
import { createPersonAction } from "@/lib/actions/people";
import { DEPARTMENTS, NO_DEPARTMENT_LABEL } from "@/lib/departments";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { USERNAME_RULE } from "@/lib/username";
import SubmitButton from "./SubmitButton";

const inputClass = controlClass();

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
      <label className="grid min-w-0 gap-1 text-xs font-medium text-secondary">
        İsim
        <input name="name" required placeholder="Örn. Ada Yılmaz" className={inputClass} />
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-secondary">
        Kullanıcı adı
        <input
          name="username"
          required
          minLength={3}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          placeholder="Örn. ada.yilmaz"
          className={inputClass}
        />
        <span className="font-normal text-muted">{USERNAME_RULE}</span>
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-secondary">
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
      <label className="grid min-w-0 gap-1 text-xs font-medium text-secondary">
        Şifre
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <label className="grid min-w-0 gap-1 text-xs font-medium text-secondary">
        Şifre tekrar
        <input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <div className="sm:col-span-2 sm:flex sm:justify-end">
        <SubmitButton>Ekip üyesi ekle</SubmitButton>
      </div>
      {error && <p role="alert" className="text-xs text-danger sm:col-span-2">{error}</p>}
    </form>
  );
}
