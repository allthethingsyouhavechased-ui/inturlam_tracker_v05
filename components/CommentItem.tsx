"use client";

import { useState, useTransition } from "react";
import MentionText from "@/components/MentionText";
import { deleteCommentAction, updateCommentAction } from "@/lib/actions/comments";
import { formatDateTime } from "@/lib/date";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { CommentWithAuthor } from "@/lib/repositories/comments";
import type { Person } from "@/lib/types";

export default function CommentItem({
  comment,
  canEdit,
  people,
}: {
  comment: CommentWithAuthor;
  canEdit: boolean;
  people: Person[];
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Bu yorum silinsin mi? Ekli görseller de silinir.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteCommentAction(comment.id);
      } catch (e) {
        setError(getActionErrorMessage(e));
      }
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("commentId", comment.id);
        fd.set("body", body);
        await updateCommentAction(fd);
        setEditing(false);
      } catch (err) {
        setError(getActionErrorMessage(err));
      }
    });
  }

  return (
    <li className="rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="mb-1 flex items-baseline gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {comment.author_name}
        </span>
        <span>{formatDateTime(comment.created_at)}</span>
        {canEdit && !editing && (
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="hover:text-brand-600 dark:hover:text-brand-400 dark:hover:text-brand-400"
            >
              Düzenle
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50"
            >
              Sil
            </button>
          </span>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-white/15 dark:bg-zinc-900"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {pending ? "…" : "Kaydet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setBody(comment.body);
                setError(null);
              }}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Vazgeç
            </button>
          </div>
        </form>
      ) : (
        comment.body && (
          <p className="whitespace-pre-wrap">
            <MentionText body={comment.body} people={people} />
          </p>
        )
      )}

      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}

      {comment.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {comment.attachments.map((a) => (
            <a key={a.id} href={a.file_path} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.file_path}
                alt={a.original_name ?? "Ek görsel"}
                className="h-24 w-24 rounded-md border border-black/10 object-cover transition-opacity hover:opacity-90 dark:border-white/15"
              />
            </a>
          ))}
        </div>
      )}
    </li>
  );
}
