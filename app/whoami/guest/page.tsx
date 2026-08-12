import GuestLoginForm from "@/components/GuestLoginForm";
import PageHeader from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function GuestLoginPage() {
  return (
    <div className="mx-auto max-w-lg py-4 sm:py-8">
      <PageHeader eyebrow="GUEST GİRİŞİ" title="Marka portalı" description="Yöneticinizin tanımladığı kullanıcı adı ve şifreyle giriş yapın." breadcrumb={[{ label: "Giriş", href: "/whoami" }, { label: "Guest" }]} />
      <section className="rounded-xl border border-border-default bg-surface p-5 shadow-sm sm:p-6"><GuestLoginForm /></section>
    </div>
  );
}
