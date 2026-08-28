"use client";

import { useRef, useState } from "react";
import { controlClass } from "@/components/ui/Input";
import { createBrandAction } from "@/lib/actions/brands";
import { getActionErrorMessage } from "@/lib/errorMessage";
import BrandLogoPicker from "./BrandLogoPicker";
import ClusterSelect from "./ClusterSelect";
import SubmitButton from "./SubmitButton";

const inputClass = controlClass();

export default function NewBrandForm({
  clusters,
}: {
  clusters: { id: string; label: string }[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  // form.reset() kontrollü <select>'i eski haline döndürmez; ClusterSelect'i
  // yeni bir key ile remount ederek iç state'ini de sıfırlıyoruz.
  const [resetKey, setResetKey] = useState(0);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        try {
          await createBrandAction(fd);
          ref.current?.reset();
          setResetKey((k) => k + 1);
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className="grid gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="grid gap-1 text-xs font-medium text-secondary">
          Marka adı
          <input
            name="name"
            required
            placeholder="Örn. Yeni Marka"
            className={inputClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-secondary">
          Kategori
          <ClusterSelect key={resetKey} clusters={clusters} className={inputClass} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-secondary">
          Instagram (opsiyonel)
          <input
            name="instagramHandle"
            placeholder="kullaniciadi"
            className={inputClass}
          />
        </label>
        <SubmitButton>Marka ekle</SubmitButton>
      </div>
      <BrandLogoPicker key={resetKey} />
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </form>
  );
}
