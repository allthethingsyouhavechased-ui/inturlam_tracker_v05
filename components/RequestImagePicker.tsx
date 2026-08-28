"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";

interface PendingImage {
  file: File;
  url: string;
}

export default function RequestImagePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<PendingImage[]>([]);

  function syncInput(next: PendingImage[]) {
    const transfer = new DataTransfer();
    next.forEach(({ file }) => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = [
      ...images,
      ...Array.from(fileList).map((file) => ({ file, url: URL.createObjectURL(file) })),
    ].slice(0, 6);
    setImages(next);
    syncInput(next);
  }

  function removeImage(index: number) {
    const image = images[index];
    if (image) URL.revokeObjectURL(image.url);
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
        <span className="text-[11px] text-muted">En fazla 6 adet PNG, JPG, GIF veya WEBP · dosya başına 8 MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        name="images"
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
