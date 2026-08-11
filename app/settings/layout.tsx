import SettingsNav from "@/components/SettingsNav";
import PageHeader from "@/components/ui/PageHeader";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Hesap"
        title="Ayarlar"
        description="Profil bilgileri ve güvenlik işlemleri ayrı alanlarda yönetilir."
      />
      <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] md:items-start">
        <aside className="md:sticky md:top-[calc(var(--header-h)+2rem)]">
          <SettingsNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
