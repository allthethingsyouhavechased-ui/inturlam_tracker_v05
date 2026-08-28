"use client";

import { useRef, useState, useTransition } from "react";
import {
  createClusterAction,
  deleteClusterAction,
  renameClusterAction,
} from "@/lib/actions/clusters";
import { getActionErrorMessage } from "@/lib/errorMessage";
import SubmitButton from "./SubmitButton";
import { buttonClass } from "./ui/Button";
import Input from "./ui/Input";

interface ClusterItem {
  id: string;
  label: string;
  brandCount: number;
}

function ClusterRow({
  cluster,
  onError,
}: {
  cluster: ClusterItem;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        action={async (fd) => {
          onError(null);
          try {
            await renameClusterAction(fd);
            setEditing(false);
          } catch (e) {
            onError(getActionErrorMessage(e));
          }
        }}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="clusterId" value={cluster.id} />
        <Input
          name="label"
          required
          autoFocus
          defaultValue={cluster.label}
        />
        <SubmitButton>Kaydet</SubmitButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={buttonClass({ variant: "ghost", size: "sm" })}
        >
          Vazgeç
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover">
      <span className="flex-1 truncate text-sm">{cluster.label}</span>
      <span className="text-xs text-muted">{cluster.brandCount} marka</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={buttonClass({ variant: "ghost", size: "sm", className: "text-muted hover:text-brand-600 dark:hover:text-brand-300" })}
      >
        Yeniden adlandır
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          onError(null);
          if (!confirm(`“${cluster.label}” kategorisi silinsin mi?`)) return;
          startTransition(async () => {
            try {
              await deleteClusterAction(cluster.id);
            } catch (e) {
              onError(getActionErrorMessage(e));
            }
          });
        }}
        className={buttonClass({ variant: "ghost", size: "sm", className: "text-muted hover:text-danger" })}
      >
        {pending ? "…" : "Sil"}
      </button>
    </div>
  );
}

export default function ClusterManager({ clusters }: { clusters: ClusterItem[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={buttonClass({
          variant: "secondary",
          className: open
            ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/35 dark:text-brand-300"
            : undefined,
        })}
      >
        <svg
          viewBox="0 0 16 16"
          className={`size-3 fill-current text-muted transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <path d="M4 2l8 6-8 6V2z" />
        </svg>
        Kategoriler
        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
          {clusters.length}
        </span>
      </button>

      {open && (
        <div className="ui-enter absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(36rem,calc(100vw-2rem))] space-y-2 rounded-xl border border-border-default bg-surface p-4 shadow-xl sm:left-auto sm:right-0">
          <div className="mb-2">
            <p className="text-sm font-semibold text-foreground">Kategori yönetimi</p>
            <p className="text-xs text-muted">
              Marka gruplarını yeniden adlandır, sil veya yenisini ekle.
            </p>
          </div>
          <div className="space-y-0.5">
            {clusters.map((c) => (
              <ClusterRow key={c.id} cluster={c} onError={setError} />
            ))}
          </div>

          <form
            ref={newFormRef}
            action={async (fd) => {
              setError(null);
              try {
                await createClusterAction(fd);
                newFormRef.current?.reset();
              } catch (e) {
                setError(getActionErrorMessage(e));
              }
            }}
            className="flex items-center gap-2 border-t border-border-subtle pt-3"
          >
            <Input
              name="label"
              required
              placeholder="Yeni kategori adı"
              aria-label="Yeni kategori adı"
            />
            <SubmitButton>Ekle</SubmitButton>
          </form>

          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
