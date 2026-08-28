"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginGuest } from "@/lib/actions/identity";
import SubmitButton from "@/components/SubmitButton";
import { controlClass } from "@/components/ui/Input";

const inputClass = controlClass();

export default function GuestLoginForm() {
  const [state, action] = useActionState(loginGuest, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">Kullanıcı adı</span>
        <input name="username" autoComplete="username" required className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-medium text-foreground">
          Şifre
          {/* Marka tarafındaki sıfırlama da ajans üzerinden yapılıyor; bağlantı
              o yolu anlatıyor (bkz. app/whoami/sifre-yardim). */}
          <Link
            href="/whoami/sifre-yardim?kind=guest"
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Şifremi unuttum
          </Link>
        </span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      {state.error && (
        <p role="alert" className="rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-danger dark:bg-rose-950/30">
          {state.error}
        </p>
      )}
      <SubmitButton>Guest olarak giriş yap</SubmitButton>
    </form>
  );
}
