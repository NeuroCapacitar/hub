import type { Metadata } from "next";
import { PageContainer } from "@/components/page-container";

export const metadata: Metadata = {
  title: "Aviso de privacidade",
};

export default function PrivacyNoticePage(): React.JSX.Element {
  return (
    <PageContainer className="max-w-3xl">
      <article className="space-y-6">
        <header>
          <h1 className="type-section-title">Aviso de privacidade</h1>
        </header>
        <section className="space-y-2">
          <h2 className="font-semibold text-xl">Dados de aprendizagem</h2>
          <p>
            O Hub mantém acesso, progresso, conclusão e posição de vídeo para
            entregar o curso contratado, permitir retomar uma aula e emitir
            certificado quando aplicável.
          </p>
          <p>
            Também registra análises opcionais de início, faixa de progresso,
            conclusão e falhas técnicas para identificar problemas nas aulas.
            Não registramos comentários, texto assistido, replay de sessão,
            endereço IP ou user agent nesse recurso.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold text-xl">Controle e retenção</h2>
          <p>
            Você pode desativar as análises opcionais em Configurações. Essa
            escolha não reduz seu acesso, progresso ou certificado. Ao
            desativar, os registros brutos identificáveis já vinculados à sua
            conta são removidos; métricas diárias sem identificação pessoal
            podem permanecer para acompanhamento de qualidade.
          </p>
          <p>
            Registros brutos ficam por até 12 meses e métricas agregadas por até
            13 meses. Mensagens enviadas pelo formulário de suporte ficam
            registradas por até 90 dias para atendimento. A prévia de um
            Certificado é removida quando ele é revogado. O PDF e os dados
            detalhados do certificado revogado são removidos após 60 dias. Para
            continuar confirmando a revogação, o Hub mantém o hash do código e a
            data enquanto a validação pública desse código estiver ativa. Na
            conclusão do curso já registrada, conserva um marcador booleano de
            emissão para impedir duplicidade. Esses marcadores não guardam o
            código original ou o conteúdo do Certificado, mas o hash não é
            tratado como dado anonimizado. O registro detalhado, nome, snapshot,
            motivo e auditoria são removidos. Para exercer direitos sobre seus
            dados, use o canal de suporte informado pela NeuroCapacitar.
          </p>
        </section>
      </article>
    </PageContainer>
  );
}
