"use client";

import { useActionState } from "react";
import { loginGuest } from "@/lib/actions/identity";
import SubmitButton from "@/components/SubmitButton";

export default function GuestLoginForm() {
  const [state, action] = useActionState(loginGuest, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-foreground">Kullanıcı adı</span><input name="username" autoComplete="username" required className="min-h-11 w-full rounded-[10px] border border-border-default bg-background px-3 text-sm outline-none focus:border-brand-500" /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-foreground">Şifre</span><input name="password" type="password" autoComplete="current-password" required className="min-h-11 w-full rounded-[10px] border border-border-default bg-background px-3 text-sm outline-none focus:border-brand-500" /></label>
      {state.error && <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton>Guest olarak giriş yap</SubmitButton>
    </form>
  );
}
