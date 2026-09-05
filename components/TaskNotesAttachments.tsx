"use client";

import { useRef, useState, useTransition } from "react";
import { deleteTaskAttachmentAction } from "@/lib/actions/tasks";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { TaskAttachment } from "@/lib/types";
import { validateImageFiles, IMAGE_UPLOAD_HINT, imageUploadCapacity } from "@/lib/imageUploadPolicy";

interface PendingImage {
  file: File;
  url: string;
}

// Notlar formunun İÇİNE gömülü — ayrı bir <form> AÇMIYOR, gerçek dosya
// input'u (name="images") üst formun DOM ağacında yaşıyor, "Kaydet"e
// basıldığında üst formla birlikte gönderiliyor (bkz. app/tasks/[taskId]/page.tsx).
// Kaydetme başarılı olunca sayfa yeniden render olur ve yukarıdan `key`
// (ek id listesine göre) değişir — bu bileşen sıfırdan mount olur, önizleme
// state'i kendiliğinden temizlenir. useEffect'siz "reset with key" deseni.
export default function TaskNotesAttachments({
  attachments,
}: {
  attachments: TaskAttachment[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function syncInput(files: File[]) {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    try { validateImageFiles([...pendingImages.map(image => image.file), ...Array.from(fileList)]); }
    catch (error) { setError((error as Error).message); syncInput(pendingImages.map(image => image.file)); return; }
    setError(null);
    const next = [
      ...pendingImages,
      ...Array.from(fileList).map((file) => ({ file, url: URL.createObjectURL(file) })),
    ];
    setPendingImages(next);
    syncInput(next.map((p) => p.file));
  }

  function removePendingImage(index: number) {
    setPendingImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      const next = prev.filter((_, i) => i !== index);
      syncInput(next.map((p) => p.file));
      return next;
    });
  }

  function removeExisting(id: string) {
    setError(null);
    startDelete(async () => {
      try {
        await deleteTaskAttachmentAction(id);
      } catch (e) {
        setError(getActionErrorMessage(e));
      }
    });
  }

  return (
    <div className="space-y-2">
      {(attachments.length > 0 || pendingImages.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div key={a.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.file_path}
                alt={a.original_name ?? "Ek görsel"}
                className="h-16 w-16 rounded-md border border-black/10 object-cover dark:border-white/15"
              />
              <button
                type="button"
                onClick={() => removeExisting(a.id)}
                disabled={deleting}
                aria-label="Görseli kaldır"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-xs leading-none text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}
          {pendingImages.map((img, i) => (
            <div key={img.url} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.file.name}
                className="h-16 w-16 rounded-md border border-dashed border-brand-400 object-cover dark:border-brand-700"
              />
              <button
                type="button"
                onClick={() => removePendingImage(i)}
                aria-label="Görseli kaldır"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-xs leading-none text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">{IMAGE_UPLOAD_HINT}</p>
      <p className="text-xs text-muted" aria-live="polite">{imageUploadCapacity(pendingImages.map(image => image.file))}</p>
      <label className="inline-block cursor-pointer text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400">
        📎 Görsel ekle
        <input
          ref={inputRef}
          type="file"
          name="images"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>
    </div>
  );
}
