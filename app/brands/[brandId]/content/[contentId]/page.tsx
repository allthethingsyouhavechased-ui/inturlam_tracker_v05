import Link from "next/link";
import { notFound } from "next/navigation";
import ArchiveContentButton from "@/components/ArchiveContentButton";
import ArchiveTaskButton from "@/components/ArchiveTaskButton";
import ApplyTemplateForm from "@/components/ApplyTemplateForm";
import AutoRefresh from "@/components/AutoRefresh";
import ContentStatusSelect from "@/components/ContentStatusSelect";
import DeleteContentButton from "@/components/DeleteContentButton";
import EditContentForm from "@/components/EditContentForm";
import KanbanBoard from "@/components/KanbanBoard";
import NewTaskForm from "@/components/NewTaskForm";
import PageHeader from "@/components/ui/PageHeader";
import { CONTENT_TYPE_LABEL } from "@/lib/constants";
import { formatDateShort } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { getBrand } from "@/lib/repositories/brands";
import { getContentItem } from "@/lib/repositories/content";
import { listActivePeople } from "@/lib/repositories/people";
import { listTemplatesForContentType } from "@/lib/repositories/templates";
import {
  listArchivedTasksByContent,
  listTasksByContent,
  sweepArchivablePublishedTasks,
} from "@/lib/repositories/tasks";
import { ARCHIVE_AFTER_DAYS, archiveCountdownBadge } from "@/lib/taskArchive";

export const dynamic = "force-dynamic";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ brandId: string; contentId: string }>;
}) {
  const me = await requirePageSession();
  const canDeleteContent = me.is_manager === 1;
  const { brandId, contentId } = await params;
  const content = getContentItem(contentId);
  const brand = getBrand(brandId);
  if (!content || !brand || content.brand_id !== brandId) notFound();

  sweepArchivablePublishedTasks();
  const tasks = listTasksByContent(contentId).map((task) => {
    const countdown = archiveCountdownBadge(task);
    return countdown ? { ...task, badges: [countdown] } : task;
  });
  const archivedTasks = listArchivedTasksByContent(contentId);
  const people = listActivePeople();
  const templates = listTemplatesForContentType(content.type);
  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeader
        eyebrow={CONTENT_TYPE_LABEL[content.type].toLocaleUpperCase("tr-TR")}
        title={content.title}
        description={[
          brand.name,
          content.assignee_name ? `Sorumlu: ${content.assignee_name}` : "Sorumlu atanmamış",
          content.target_date ? `Hedef: ${formatDateShort(content.target_date)}` : "Hedef tarihi yok",
        ].join(" · ")}
        breadcrumb={[
          { label: "Markalar", href: "/brands" },
          { label: brand.name, href: `/brands/${brand.id}` },
          { label: content.title },
        ]}
        actions={
          <>
            <ContentStatusSelect contentId={content.id} status={content.status} />
            <EditContentForm content={content} people={people} />
            <ArchiveContentButton contentId={content.id} archived={content.archived === 1} />
            {canDeleteContent && <DeleteContentButton contentId={content.id} />}
          </>
        }
      />

      <section className="space-y-3 rounded-xl border border-border-default bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Görev oluştur</h2>
            <p className="mt-0.5 text-xs text-muted">Tek görev ekle veya standart bir iş akışını şablondan getir.</p>
          </div>
          <ApplyTemplateForm
            contentItemId={content.id}
            templates={templates}
            defaultAssigneeId={content.assignee_id ?? me.id}
            hasTargetDate={Boolean(content.target_date)}
          />
        </div>
        <NewTaskForm
          contentItemId={content.id}
          defaultContentType={content.type}
          canSetWeight={me.is_manager === 1}
          people={people}
          defaultAssigneeId={me?.id ?? null}
        />
      </section>

      <section>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Bir kartı tutup başka bir sütuna sürükleyerek durumunu değiştirebilirsin.
          Yayınlananlar {ARCHIVE_AFTER_DAYS} gün panoda kalır, sonra aşağıdaki
          arşive düşer.
        </p>
        <KanbanBoard tasks={tasks} people={people} />
      </section>

      {/* Arşiv panoyu şişirmesin diye katlanmış geliyor. Kayıtlar silinmedi:
          başlık linki görev detayına gider, düğme tek tıkla panoya geri koyar. */}
      {archivedTasks.length > 0 && (
        <details className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <summary className="cursor-pointer text-sm font-semibold">
            Arşiv ({archivedTasks.length})
          </summary>
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/5">
            {archivedTasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <Link
                  href={`/tasks/${task.id}`}
                  className="min-w-0 text-sm hover:text-brand-600 dark:hover:text-brand-400"
                >
                  <span className="block truncate font-medium">{task.title}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {task.assignee_name ?? "Atanmamış"} ·{" "}
                    {formatDateShort(task.completed_at?.slice(0, 10) ?? null)} tarihinde
                    tamamlandı
                  </span>
                </Link>
                <ArchiveTaskButton taskId={task.id} archived />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
