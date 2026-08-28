"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MentionText from "@/components/MentionText";
import { getTaskCommentsAction } from "@/lib/actions/comments";
import { formatDateTime } from "@/lib/date";
import type { CommentWithAuthor } from "@/lib/repositories/comments";
import type { Person } from "@/lib/types";

// Liste görünümündeki Yorum sütununa tıklayınca açılan salt-okunur yan panel —
// görev sayfasına gitmeden "burada ne konuşulmuş" sorusunu cevaplar. Düzenleme/
// silme/yeni yorum ekleme burada YOK, bilinçli olarak: o akış zaten görev
// detayında (CommentItem/CommentForm) var, burayı ikinci bir düzenleme yüzeyi
// yapmak karmaşıklığı arttırırdı.
export default function TaskCommentsPanel({
  taskId,
  taskTitle,
  people,
  onClose,
}: {
  taskId: string;
  taskTitle: string;
  people: Person[];
  onClose: () => void;
}) {
  const [comments, setComments] = useState<CommentWithAuthor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTaskCommentsAction(taskId)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) setError("Yorumlar yüklenemedi.");
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="relative flex h-full w-full max-w-sm flex-col gap-3 overflow-y-auto border-l border-black/10 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{taskTitle}</h2>
            <Link
              href={`/tasks/${taskId}`}
              className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              Görevi aç
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="touch-target -m-2 shrink-0 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        {comments === null && !error && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Yükleniyor…</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {comments && comments.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Henüz yorum yok.</p>
        )}
        {comments && comments.length > 0 && (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-950"
              >
                <div className="mb-1 flex items-baseline gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {c.author_name}
                  </span>
                  <span>{formatDateTime(c.created_at)}</span>
                </div>
                {c.body && (
                  <p className="whitespace-pre-wrap">
                    <MentionText body={c.body} people={people} />
                  </p>
                )}
                {c.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.attachments.map((a) => (
                      <a key={a.id} href={a.file_path} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={a.file_path}
                          alt={a.original_name ?? "Ek görsel"}
                          className="h-16 w-16 rounded-md border border-black/10 object-cover transition-opacity hover:opacity-90 dark:border-white/15"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
