"use client";

import { useRef, useState, useTransition } from "react";
import MentionTextarea from "@/components/MentionTextarea";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import { addCommentAction } from "@/lib/actions/comments";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { validateImageFiles, IMAGE_UPLOAD_HINT, imageUploadCapacity } from "@/lib/imageUploadPolicy";

interface PendingImage {
  file: File;
  url: string;
}

export default function CommentForm({ taskId }: { taskId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Metin artık form DOM'undan değil state'ten okunuyor: `@` önerisi seçildiğinde
  // bileşenin metni değiştirmesi gerekiyor (bkz. MentionTextarea).
  const [body, setBody] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    try { validateImageFiles([...images.map(image => image.file), ...Array.from(fileList)]); }
    catch (error) { setError((error as Error).message); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    setError(null);
    const next = Array.from(fileList).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function reset() {
    formRef.current?.reset();
    setBody("");
    setImages((prev) => {
      for (const img of prev) URL.revokeObjectURL(img.url);
      return [];
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData();
        fd.set("taskId", taskId);
        fd.set("body", body);
        for (const { file } of images) fd.append("images", file);
        startTransition(async () => {
          try {
            await addCommentAction(fd);
            reset();
          } catch (err) {
            setError(getActionErrorMessage(err));
          }
        });
      }}
      className="flex flex-col gap-2"
    >
      <MentionTextarea
        name="body"
        rows={2}
        value={body}
        onValueChange={setBody}
        placeholder="Bir not ekle… (@ ile kişi etiketle)"
        className={controlClass("min-h-16 resize-y py-2")}
      />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={img.url} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.file.name}
                className="h-16 w-16 rounded-md border border-black/10 object-cover dark:border-white/15"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label="Görseli kaldır"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger-solid text-xs leading-none text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">{IMAGE_UPLOAD_HINT}</p>
      <p className="text-xs text-muted" aria-live="polite">{imageUploadCapacity(images.map(image => image.file))}</p>
      <div className="flex items-center justify-between gap-2">
        <label className="cursor-pointer text-xs font-medium text-muted hover:text-brand-600 dark:hover:text-brand-400">
          📎 Görsel ekle
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
        <button type="submit" disabled={pending} className={buttonClass({ size: "sm" })}>
          {pending ? "Ekleniyor…" : "Yorum ekle"}
        </button>
      </div>
    </form>
  );
}
