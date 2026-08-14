import Link from "next/link";
import ChangeUsernameForm from "@/components/ChangeUsernameForm";
import EditPersonProfileForm from "@/components/EditPersonProfileForm";
import PersonAvatar from "@/components/PersonAvatar";
import Badge from "@/components/ui/Badge";
import { requirePageSession } from "@/lib/identity";
import { departmentLabel } from "@/lib/departments";
import { getPerson } from "@/lib/repositories/people";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; saved?: string }>;
}) {
  const current = await requirePageSession();
  const { person: requestedId, saved } = await searchParams;
  const requested = requestedId ? getPerson(requestedId) : null;
  const person = requested && (requested.id === current.id || current.is_manager === 1)
    ? requested
    : current;

  return (
    <section aria-labelledby="profile-settings-title" className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="profile-settings-title" className="text-lg font-semibold tracking-[-0.015em]">Profil bilgileri</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            Buradaki bilgiler ekip profilinde görünür; görev ve güvenlik verileri bu alana dahil değildir.
          </p>
        </div>
        <Link href={`/team/${person.id}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300">
          Profili görüntüle →
        </Link>
      </div>

      {requested && requested.id !== current.id && (
        <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-subtle p-3">
          <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{person.name}</p>
            <p className="truncate text-[11px] text-muted">{departmentLabel(person.department)}</p>
          </div>
          <Badge tone="warning">Yönetici düzenlemesi</Badge>
        </div>
      )}

      {saved === "1" && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-300">
          Profil bilgileri kaydedildi.
        </div>
      )}

      <EditPersonProfileForm person={person} />
      <ChangeUsernameForm person={person} />
    </section>
  );
}
