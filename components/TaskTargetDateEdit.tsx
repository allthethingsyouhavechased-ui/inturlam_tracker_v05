"use client";

import { useRef, useState, useTransition } from "react";
import Icon from "@/components/ui/Icon";
import { setPersonalTaskTargetAction } from "@/lib/actions/tasks";
import { formatDateShort, todayISO } from "@/lib/date";
import { getActionErrorMessage } from "@/lib/errorMessage";

// Kişisel hedef tarihini yerinde düzenler. Yalnızca oturumdaki kişiye atanmış
// görevler için anlamlı: sunucu tarafı zaten `assignee_id !== person.id`
// durumunda hata veriyor, arayüz de bu bileşeni sadece `personal_target_date`
// alanı TAŞINAN görevlerde gösteriyor (alanın undefined olması "bu görev benim
// değil" demek, bkz. lib/types.ts).
//
// Neden "düğmeye basınca yerine <input> koy" DEĞİL de gizli input + showPicker:
// ilk sürüm düğmeyi bir `type="date"` input'uyla değiştiriyordu ve React'in
// `onChange`'i aslında native `input` olayına bağlı — tarih henüz yarım
// yazılmışken input boş string ("") üretiyor, bu da "hedefi kaldır" sayılıp
// düzenlemeyi kapatıyordu. Sonuç: HEDEFİ OLMAYAN görevlere tarih girmek
// imkânsızdı (var olanlar seçiciyle tek seferde tam değer ürettiği için
// çalışıyordu). Şimdi görünen şey hep düğme; tıklayınca tarayıcının kendi
// tarih seçicisi açılıyor ve yalnızca TAM bir tarih kaydediliyor.
export default function TaskTargetDateEdit({
  taskId,
  targetDate,
  compact = false,
}: {
  taskId: string;
  targetDate: string | null;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await setPersonalTaskTargetAction(taskId, next);
      } catch (cause) {
        setError(getActionErrorMessage(cause));
      }
    });
  }

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    // `min` burada atanıyor, render'da değil: `todayISO()` sunucu ve istemcide
    // gün sınırında farklı çıkabilir ve öznitelik uyuşmazlığı üretirdi.
    input.min = todayISO();
    try {
      input.showPicker();
    } catch {
      // showPicker desteklenmiyor/izin verilmedi: input'a odaklan, kullanıcı
      // klavyeyle de girebilsin.
      input.focus();
    }
  }

  return (
    <span className="inline-flex min-w-0 flex-col">
      <span className="relative inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={openPicker}
          disabled={pending}
          title={
            targetDate
              ? "Kişisel hedef tarihini değiştir"
              : "Kişisel hedef tarihi belirle (yalnızca sana görünür)"
          }
          className={`ui-press inline-flex items-center gap-1 whitespace-nowrap rounded-lg text-[11px] tabular-nums hover:bg-surface-hover disabled:opacity-50 ${
            compact ? "min-h-7 px-0 hover:bg-transparent" : "min-h-8 px-1.5"
          } ${
            targetDate
              ? "font-medium text-brand-600 dark:text-brand-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <Icon name="clock" className="size-3.5" />
          {pending ? "…" : targetDate ? formatDateShort(targetDate) : "Hedef ekle"}
        </button>

        {targetDate && (
          <button
            type="button"
            onClick={() => save(null)}
            disabled={pending}
            title="Kişisel hedefi kaldır"
            aria-label="Kişisel hedefi kaldır"
            className={`${compact ? "ml-0.5" : "touch-target"} inline-flex size-7 items-center justify-center rounded-lg text-faint hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400`}
          >
            <Icon name="close" className="size-3" />
          </button>
        )}

        {/* Görünmez ama "render edilmiş" olmak zorunda: `showPicker()` gizli
            (display:none) bir öğede çalışmaz. Düğmenin üstünde duruyor ama
            tıklamaları geçiriyor, seçici de bu yüzden düğmenin hizasında açılıyor. */}
        <input
          ref={inputRef}
          type="date"
          value={targetDate ?? ""}
          disabled={pending}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const next = event.target.value;
            // Yarım/boş değeri YOK SAY — hedefi kaldırmanın tek yolu × düğmesi.
            if (next) save(next);
          }}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
      </span>

      {error && (
        <span role="alert" className="max-w-40 text-[11px] text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
