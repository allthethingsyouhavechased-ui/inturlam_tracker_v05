"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm dark:border-rose-900 dark:bg-rose-950/40">
      <h2 className="mb-1 font-semibold text-rose-700 dark:text-rose-300">
        Bir şeyler ters gitti
      </h2>
      <p className="mb-4 text-rose-600 dark:text-rose-400">
        İşlem tamamlanamadı. Sayfayı yeniden deneyebilir veya güvenli biçimde geri dönebilirsiniz.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
      >
        Tekrar dene
      </button>
    </div>
  );
}
