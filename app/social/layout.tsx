import SocialTabs from "@/components/SocialTabs";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/date";
import { getLatestSyncRun } from "@/lib/repositories/social";

export const dynamic = "force-dynamic";

// Sosyal menüsünün üç kardeş sayfası (Takip/Varlık/Paylaşım Takvimi) arasında
// ortak sekme şeridi. Uygulamanın İLK iç içe layout'u — kök layout zaten
// page-shell sarmalını (max-w-7xl px-4 py-6) veriyor, o yüzden burada AYRICA
// padding/max-w eklenmez, yalnızca sekmeler.
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  const latestRun = getLatestSyncRun();

  return (
    <div>
      <PageHeader
        eyebrow="PORTFÖY"
        title="Sosyal"
        description="Hesap sağlığını, hazır içerik stoklarını ve haftalık paylaşım planını tek çalışma alanında yönet."
        summary={
          <div className="border-l-2 border-brand-500 pl-4 sm:ml-auto sm:max-w-md">
            <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
              <p className="text-xs font-semibold text-foreground">Hesap sağlığı</p>
              <p className="text-[11px] font-medium text-secondary">
                {latestRun
                  ? `Son tarama ${formatDateTime(latestRun.started_at)}`
                  : "Henüz tarama yapılmadı"}
              </p>
            </div>
            <p
              className={`mt-1 text-[11px] leading-4 ${
                latestRun?.status === "error" ? "text-rose-600 dark:text-rose-400" : "text-muted"
              }`}
            >
              {latestRun?.status === "error"
                ? `Tarama hatası: ${latestRun.error ?? "bilinmiyor"}`
                : latestRun?.status === "running"
                  ? "Tarama sürüyor…"
                  : latestRun
                    ? `${latestRun.accounts} hesap kontrol edildi · ${latestRun.new_posts} yeni gönderi`
                    : "Takip için marka hesaplarını bağla."}
            </p>
          </div>
        }
      />
      <div className="mb-6">
        <SocialTabs />
      </div>
      <div>{children}</div>
    </div>
  );
}
