"use client";

import { useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { updatePersonUsernameAction } from "@/lib/actions/people";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { USERNAME_RULE } from "@/lib/username";
import type { Person } from "@/lib/types";

// Kullanıcı adı profil formundan AYRI duruyor: profil alanları (ad, unvan,
// tanıtım) görüntüleme bilgisi, kullanıcı adı ise giriş kimliği. Aynı formda
// olsalardı bir yazım hatası kaydedildiğinde kişi bir dahaki girişte adını
// bulamayabilirdi; ayrı kart, ayrı onay bunu görünür kılıyor.
export default function ChangeUsernameForm({ person }: { person: Person }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <Card
      as="form"
      action={async (formData: FormData) => {
        setError(null);
        setSaved(false);
        try {
          await updatePersonUsernameAction(formData);
          setSaved(true);
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="personId" value={person.id} />
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">Kullanıcı adı</h3>
        <p className="mt-1 text-xs leading-5 text-muted">
          Giriş ekranına yazılan ad. Değiştirmek açık oturumları düşürmez; yeni ad
          bir sonraki girişte geçerli olur.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1.5 text-[13px] font-semibold text-secondary">
          <span className="sr-only">Kullanıcı adı</span>
          <Input
            name="username"
            required
            minLength={3}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            defaultValue={person.username ?? ""}
            placeholder="ornek.kullanici"
          />
        </label>
        <SubmitButton>Kullanıcı adını kaydet</SubmitButton>
      </div>

      <p className="text-xs text-muted">{USERNAME_RULE}</p>

      {person.username === null && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Bu hesabın kullanıcı adı henüz belirlenmemiş; şu an yalnızca tam adıyla
          giriş yapabiliyor.
        </p>
      )}
      {saved && (
        <p role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Kullanıcı adı kaydedildi.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </Card>
  );
}
