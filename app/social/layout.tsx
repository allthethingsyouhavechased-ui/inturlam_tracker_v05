import SocialTabs from "@/components/SocialTabs";

// Sosyal menüsünün üç kardeş sayfası (Takip/Varlık/Paylaşım Takvimi) arasında
// ortak sekme şeridi. Uygulamanın İLK iç içe layout'u — kök layout zaten
// page-shell sarmalını (max-w-7xl px-4 py-6) veriyor, o yüzden burada AYRICA
// padding/max-w eklenmez, yalnızca sekmeler.
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SocialTabs />
      {children}
    </div>
  );
}
