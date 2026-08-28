import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

// Bu sayfa oturum AÇILMADAN görülüyor. Bu yüzden burada kişi listesi, yönetici
// adı ya da hangi kullanıcı adının var olduğu bilgisi YOK — /whoami/team'deki
// aynı gerekçe (giriş ekranı bir personel dizinine dönüşmesin).
//
// E-postayla otomatik sıfırlama bilerek yok: uygulamanın hiçbir yerinde e-posta
// gönderme altyapısı (SMTP) tanımlı değil ve LAN'da çalışan bir iç araca bunu
// eklemek, sıfırlama bağlantısını taşıyacak yeni bir saldırı yüzeyi demek.
// Sıfırlama insan eliyle, kimliği zaten bilinen bir yönetici üzerinden yapılır.

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-semibold tabular-nums text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
      >
        {number}
      </span>
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-muted">{children}</p>
      </div>
    </li>
  );
}

export default async function PasswordHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const isGuest = kind === "guest";
  const backHref = isGuest ? "/whoami/guest" : "/whoami/team";

  return (
    <div className="mx-auto max-w-md py-4 sm:py-8">
      <PageHeader
        eyebrow="ŞİFRE YARDIMI"
        title="Şifreni mi unuttun?"
        description="Şifreler geri okunamayacak biçimde saklanır — kimse mevcut şifreni sana söyleyemez, yalnızca yenisi belirlenebilir."
        breadcrumb={[
          { label: "Giriş", href: "/whoami" },
          { label: isGuest ? "Marka" : "Ekip", href: backHref },
          { label: "Şifre yardımı" },
        ]}
      />

      <section className="rounded-2xl border border-border-default bg-surface p-5 sm:p-6">
        <h2 className="text-h2 text-foreground">Nasıl sıfırlanır</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {isGuest ? (
            <>
              <Step number={1} title="İNTURLAM ile iletişime geç">
                Markanın hesabını açan kişi aynı zamanda şifreni yenileyebilir.
              </Step>
              <Step number={2} title="Yeni şifreni al">
                Ajans, <strong>Ekip → Hesap yönetimi</strong> ekranından markanın guest
                hesabına yeni bir şifre belirler.
              </Step>
              <Step number={3} title="Yeni şifreyle gir">
                Yeni şifre verildiği anda giriş kilidi de kalkar; 15 dakika beklemen
                gerekmez.
              </Step>
            </>
          ) : (
            <>
              <Step number={1} title="Bir yöneticiye söyle">
                Yönetici yetkisi olan ekip arkadaşların şifreni yenileyebilir.
              </Step>
              <Step number={2} title="Yönetici şifreyi yeniler">
                <strong>Ekip → Hesap yönetimi</strong> ekranında adının yanındaki
                &quot;Şifre belirle&quot; ile yeni şifre verilir. Yönetici hesaplarının
                şifresini yalnızca sistem yöneticisi yenileyebilir.
              </Step>
              <Step number={3} title="Gir ve kendi şifreni koy">
                Yeni şifreyle giriş yaptıktan sonra <strong>Ayarlar → Güvenlik</strong>
                &nbsp;bölümünden kendi şifrenle değiştir.
              </Step>
            </>
          )}
        </ol>
      </section>

      <div className="mt-5 rounded-2xl border border-border-subtle bg-surface-subtle p-4">
        <p className="text-[13px] leading-5 text-secondary">
          <strong className="font-semibold text-foreground">Çok fazla hatalı deneme</strong>{" "}
          uyarısı aldıysan hesap 15 dakika kilitlenir. Şifren yenilendiğinde bu kilit
          otomatik kalkar — beklemene gerek yok.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        <Link href={backHref} className={buttonClass({ variant: "secondary" })}>
          Giriş ekranına dön
        </Link>
      </div>
    </div>
  );
}
