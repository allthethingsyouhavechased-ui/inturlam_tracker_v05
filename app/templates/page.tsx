import TemplateManager from "@/components/TemplateManager";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { listTemplatesWithItems } from "@/lib/repositories/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const me = await requirePageSession();
  const templates = listTemplatesWithItems();
  const taskCount = templates.reduce((total, template) => total + template.items.length, 0);

  return (
    <div>
      <PageHeader
        eyebrow="GÖREV ALTYAPISI"
        title="Görev şablonları"
        description={`${templates.length} şablonda ${taskCount} standart görev adımı. Şablonları proje oluştururken veya içerik detayından uygulayabilirsin.`}
        breadcrumb={[{ label: "Görevler", href: "/tasks" }, { label: "Şablonlar" }]}
      />
      <TemplateManager
        templates={templates}
        canDeleteTemplates={me.is_manager === 1}
      />
    </div>
  );
}
