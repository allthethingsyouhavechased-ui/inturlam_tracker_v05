"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { validateImageFiles, IMAGE_UPLOAD_HINT, imageUploadCapacity } from "@/lib/imageUploadPolicy";

interface PendingImage {
  file: File;
  url: string;
}

export default function RequestImagePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const [images, setImages] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    const currentUrls = urls.current;
    const release = () => { currentUrls.forEach(url => URL.revokeObjectURL(url)); currentUrls.clear(); };
    const reset = () => { release(); setImages([]); setError(null); };
    form?.addEventListener("reset", reset);
    return () => { form?.removeEventListener("reset", reset); release(); };
  }, []);

  function syncInput(next: PendingImage[]) {
    const transfer = new DataTransfer();
    next.forEach(({ file }) => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    try { validateImageFiles([...images.map(image => image.file), ...Array.from(fileList)]); }
    catch (error) { setError((error as Error).message); syncInput(images); return; }
    setError(null);
    const next = [
      ...images,
      ...Array.from(fileList).map((file) => { const url = URL.createObjectURL(file); urls.current.add(url); return { file, url }; }),
    ];
    setImages(next);
    syncInput(next);
  }

  function removeImage(index: number) {
    const image = images[index];
    if (image) { URL.revokeObjectURL(image.url); urls.current.delete(image.url); }
    const next = images.filter((_, current) => current !== index);
    setImages(next);
    syncInput(next);
  }

  return (
    <div className="space-y-2 lg:col-span-12">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="ui-press inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-dashed border-border-strong bg-surface-subtle px-3 text-xs font-semibold text-secondary hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/30 dark:hover:text-brand-200"
        >
          <Icon name="plus" className="size-4" /> Görsel ekle
        </button>
        <span className="text-[11px] text-muted">{IMAGE_UPLOAD_HINT}</span>
      </div>
      <p className="text-xs text-muted" aria-live="polite">{imageUploadCapacity(images.map(image => image.file))}</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        name="images"
        aria-label="Yüklenecek görseller"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Yüklenecek talep görselleri">
          {images.map((image, index) => (
            <li key={image.url} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.file.name}
                className="size-20 rounded-[10px] border border-border-default object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                aria-label={`${image.file.name} görselini kaldır`}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-danger-solid text-white shadow-sm"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
