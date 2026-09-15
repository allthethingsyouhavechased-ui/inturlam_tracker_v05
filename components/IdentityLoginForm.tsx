"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginPerson } from "@/lib/actions/identity";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";

const inputClass = controlClass();

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
        <span className="flex items-baseline justify-between gap-3">
          Şifre
          {/* Sıfırlama e-postayla değil bir yönetici üzerinden yapılıyor; bu
              bağlantı o yolu ANLATIYOR. Eskiden hiçbir yerde yazmıyordu ve
              kilitlenen kişi ekranda sadece "hatalı deneme" görüyordu. */}
          <Link
            href="/whoami/sifre-yardim"
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Şifremi unuttum
          </Link>
        </span>
        <input
          name="password"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      {/* Varsayılan KAPALI: ortak ofis bilgisayarında unutulmuş oturum
          riskini kullanıcı bilerek üstlensin. Seçilmezse mevcut 12 saatlik
          tarayıcı-oturumu davranışı korunur. */}
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input name="remember" type="checkbox" value="1" className="size-4" />
        Beni bu cihazda hatırla
        <span className="text-xs text-muted">(30 gün)</span>
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-danger dark:bg-rose-950/30">
          {state.error}
        </p>
      )}
      <SubmitButton className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-500 disabled:opacity-50">
        Giriş yap
      </SubmitButton>
    </form>
  );
}
