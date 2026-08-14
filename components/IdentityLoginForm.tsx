"use client";

import { useActionState } from "react";
import { loginPerson } from "@/lib/actions/identity";
import SubmitButton from "@/components/SubmitButton";

const inputClass =
  "min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-white/15 dark:bg-zinc-950";

export default function IdentityLoginForm() {
  const [state, action] = useActionState(loginPerson, {});

  return (
    <form action={action} className="space-y-4">
      <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Kullanıcı adı / ID
        <input
          name="username"
          type="text"
          required
          maxLength={120}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          className={inputClass}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Şifre
        <input
          name="password"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {state.error}
        </p>
      )}
      <SubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-500 disabled:opacity-50">
        Giriş yap
      </SubmitButton>
    </form>
  );
}
