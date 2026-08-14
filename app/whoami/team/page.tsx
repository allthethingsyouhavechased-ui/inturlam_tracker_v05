import IdentityLoginForm from "@/components/IdentityLoginForm";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

// /whoami altındaki sayfalar oturum açılmadan erişilebilir. Bu nedenle ekip
// listesi burada gösterilmez; aksi halde giriş ekranı herkese açık bir personel
// dizinine ve hazır kullanıcı kimliği listesine dönüşür. Ana /whoami sayfası
// ekip/guest ayrımını korur, bu sayfa yalnızca ekip kimlik bilgilerini toplar.
export default async function TeamLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const { changed } = await searchParams;

  return (
    <div className="mx-auto max-w-md py-4 sm:py-8">
      <PageHeader
        eyebrow="EKİP GİRİŞİ"
        title="Ekip hesabınla giriş yap"
        description="Kullanıcı adın veya ekip ID'n ile şifreni kullan."
        breadcrumb={[{ label: "Giriş", href: "/whoami" }, { label: "Ekip" }]}
      />
      {changed === "1" && (
        <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/25 dark:text-emerald-300">
          Şifren değiştirildi. Yeni şifrenle tekrar giriş yap.
        </p>
      )}
      <section className="space-y-5 rounded-xl border border-border-default bg-surface p-5 sm:p-6">
        <IdentityLoginForm />
      </section>
      <p className="mt-4 text-center text-xs text-muted">
        Kullanıcı adını bilmiyorsan bir yöneticiden öğrenebilirsin.
      </p>
    </div>
  );
}
