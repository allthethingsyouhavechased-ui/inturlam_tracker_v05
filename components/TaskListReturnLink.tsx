"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readTaskListReturn, returnLabelForHref } from "@/lib/taskListNavigation";
const subscribe = () => () => {};
// Kayıt BAŞKA bir görev için yazılmışsa kullanılmaz: doğrudan açılan görev
// (bağlantıyla, bildirimden) varsayılan olarak görev listesine döner.
function snapshot() {
  const saved = readTaskListReturn();
  return saved?.taskPath === window.location.pathname ? saved.href : "/tasks";
}
export default function TaskListReturnLink() {
  const href = useSyncExternalStore(subscribe,snapshot,() => "/tasks");
  return (
    <Link href={href} scroll={false} className="mb-3 inline-flex min-h-10 items-center text-sm font-semibold text-brand-600">
      ← {returnLabelForHref(href)}
    </Link>
  );
}
