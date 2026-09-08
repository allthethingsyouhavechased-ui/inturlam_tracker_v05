"use client";

import { useRef, useState } from "react";
import PersonAvatar from "@/components/PersonAvatar";
import { validateImageFiles } from "@/lib/imageUploadPolicy";

export default function PersonAvatarPicker({
  name,
  currentAvatarPath,
}: {
  name: string;
  currentAvatarPath: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    try { if (file) validateImageFiles([file]); }
    catch (error) { setError((error as Error).message); event.target.value = ""; return; }
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // Blob önizlemeleri next/image optimizasyon hattından geçmez.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={`${name} yeni profil fotoğrafı önizlemesi`}
          className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-brand-500/20"
        />
      ) : (
        <PersonAvatar name={name} avatarPath={currentAvatarPath} size="xl" />
      )}

      <div className="space-y-1.5">
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-brand-700 dark:hover:text-brand-300"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M4 8.5h3l1.4-2h7.2l1.4 2h3v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="14" r="3.25" stroke="currentColor" strokeWidth="1.75" />
          </svg>
          {currentAvatarPath ? "Fotoğrafı değiştir" : "Profil fotoğrafı ekle"}
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          PNG, JPG, GIF veya WEBP · en fazla 20 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
