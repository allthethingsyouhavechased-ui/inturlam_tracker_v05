"use client";

import { useRef, useState } from "react";
import { validateImageFiles } from "@/lib/imageUploadPolicy";

// `NewBrandForm`/`EditBrandForm`'un İÇİNE gömülü — kendi <form>'unu açmıyor,
// input'u (name="logo") üst formla birlikte gönderilir. Seçilen dosyanın
// önizlemesi yerelde (object URL) gösterilir, gerçek yükleme üst form
// gönderildiğinde `lib/actions/brands.ts`'te olur.
export default function BrandLogoPicker({
  currentLogoPath = null,
}: {
  currentLogoPath?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    try { if (file) validateImageFiles([file]); }
    catch (error) { setError((error as Error).message); e.target.value = ""; return; }
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  const shown = preview ?? currentLogoPath;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt="Marka logosu"
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10"
        />
      ) : (
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/5 text-xl text-zinc-400 dark:bg-white/10 dark:text-zinc-500"
          aria-hidden
        >
          🏢
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400"
      >
        📎 {currentLogoPath ? "Logoyu değiştir" : "Logo ekle"}
      </button>
      <input
        ref={inputRef}
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
