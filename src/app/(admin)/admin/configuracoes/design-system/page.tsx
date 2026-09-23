import { DesignSystemPreview } from "@/components/design-system-preview";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth-permissions";

export default async function DesignSystemPage(): Promise<React.JSX.Element> {
  await requirePermission("viewSettings");

  return (
    <PageContainer>
      <PageHeader
        description="Referência dos componentes, estados e padrões visuais usados no Hub."
        title="Sistema visual"
      />
      <div className="pt-8">
        <DesignSystemPreview />
      </div>
    </PageContainer>
  );
}
