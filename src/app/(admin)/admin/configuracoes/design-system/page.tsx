import { DesignSystemPreview } from "@/components/design-system-preview";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export default function DesignSystemPage(): React.JSX.Element {
  return (
    <PageContainer>
      <PageHeader
        description="Fixture interna para revisar papéis de cor, estados, foco e superfícies antes de alterar novas telas."
        title="Sistema visual"
      />
      <div className="pt-8">
        <DesignSystemPreview />
      </div>
    </PageContainer>
  );
}
