import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Exclusão de Dados — LoopSale",
  description:
    "Como solicitar a exclusão dos seus dados na LoopSale (operada por MIOS TECH SOFTWARE HOUSE LTDA).",
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 text-xl font-semibold text-[var(--loop-text)]">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-[var(--loop-text-muted)]">
      {children}
    </p>
  );
}

export default function ExclusaoDeDadosPage() {
  return (
    <LegalShell title="Exclusão de Dados" updatedAt="28/07/2026">
      <P>
        A <strong>LoopSale</strong>, operada por{" "}
        <strong>MIOS TECH SOFTWARE HOUSE LTDA</strong>, permite que você solicite a
        exclusão dos seus dados pessoais a qualquer momento. Abaixo explicamos como.
      </P>

      <H>1. Se você é usuário da LoopSale</H>
      <P>
        Você pode excluir sua conta e todos os dados associados diretamente na
        plataforma, em <strong>Configurações → Privacidade e dados (LGPD) →
        Excluir conta e dados</strong>. A exclusão remove permanentemente a conta,
        os leads, vendas, integrações e mensagens vinculados a ela.
      </P>
      <P>
        Você também pode <strong>exportar seus dados</strong> antes de excluir, na
        mesma tela.
      </P>

      <H>2. Se você é cliente final (recebeu uma mensagem)</H>
      <P>
        Se você recebeu uma mensagem enviada por meio da LoopSale e deseja que seus
        dados sejam removidos, envie um pedido para{" "}
        <strong>contato@loopsale.com.br</strong> informando o número de telefone ou
        e-mail utilizado. Encaminharemos a solicitação ao responsável (o
        infoprodutor que fez o contato) e removeremos os dados que tratamos como
        operadora.
      </P>

      <H>3. Solicitação por e-mail</H>
      <P>
        Em qualquer caso, você pode solicitar a exclusão enviando um e-mail para{" "}
        <strong>contato@loopsale.com.br</strong> com o assunto{" "}
        <strong>&quot;Exclusão de dados&quot;</strong>, informando os dados de
        identificação (e-mail e/ou telefone). Responderemos e concluiremos a
        exclusão nos prazos previstos na LGPD.
      </P>

      <H>4. O que é excluído</H>
      <P>
        São removidos os dados pessoais associados à solicitação, ressalvadas as
        informações que precisamos manter por obrigação legal (por exemplo,
        registros fiscais e financeiros), que são guardadas apenas pelo prazo
        exigido e depois eliminadas.
      </P>

      <H>5. Prazo</H>
      <P>
        Solicitações são processadas normalmente em até 15 dias, podendo ser
        prorrogadas mediante justificativa, conforme a LGPD.
      </P>

      <H>6. Contato</H>
      <P>
        Canal de privacidade: <strong>contato@loopsale.com.br</strong>. Operadora:
        MIOS TECH SOFTWARE HOUSE LTDA.
      </P>
    </LegalShell>
  );
}
