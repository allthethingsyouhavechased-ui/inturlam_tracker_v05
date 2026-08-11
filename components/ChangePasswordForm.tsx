"use client";

import { useActionState } from "react";
import { changePassword } from "@/lib/actions/identity";
import SubmitButton from "@/components/SubmitButton";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export default function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, {});

  return (
    <Card as="form" action={action} className="space-y-5">
      <label className="grid gap-1.5 text-[13px] font-semibold text-secondary">
        Mevcut şifre
        <Input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[13px] font-semibold text-secondary">
          Yeni şifre
          <Input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-secondary">
          Yeni şifre tekrar
          <Input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {state.error}
        </p>
      )}
      <div className="flex justify-end border-t border-border-subtle pt-4">
        <SubmitButton>Şifreyi değiştir</SubmitButton>
      </div>
    </Card>
  );
}
