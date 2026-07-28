import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Política de Privacidade — LoopSale",
  description:
    "Como a LoopSale (operada por MIOS TECH SOFTWARE HOUSE LTDA) coleta, usa e protege dados pessoais.",
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

export default function PoliticaPrivacidadePage() {
  return (
    <LegalShell title="Política de Privacidade" updatedAt="28/07/2026">
      <P>
        Esta Política descreve como a plataforma <strong>LoopSale</strong>,
        operada por <strong>MIOS TECH SOFTWARE HOUSE LTDA</strong> (&quot;LoopSale&quot;,
        &quot;nós&quot;), coleta, utiliza, compartilha e protege dados pessoais, em
        conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 —
        LGPD).
      </P>

      <H>1. Quem somos</H>
      <P>
        A LoopSale é uma plataforma de recuperação de vendas e pós-venda para
        infoprodutores, que se integra a plataformas de checkout (como Kiwify e
        Hotmart) e ao WhatsApp para automatizar a comunicação com os clientes dos
        nossos usuários. O controlador dos dados tratados por conta própria é a
        MIOS TECH SOFTWARE HOUSE LTDA.
      </P>

      <H>2. Dados que coletamos</H>
      <P>
        <strong>Dados de conta (nossos usuários):</strong> nome, e-mail, telefone,
        nome da empresa e credenciais de acesso.
      </P>
      <P>
        <strong>Dados de integração:</strong> eventos enviados pelas plataformas
        de checkout (carrinho abandonado, pagamento aprovado/recusado, reembolso),
        incluindo e-mail, telefone, produto e valor do cliente final.
      </P>
      <P>
        <strong>Dados de mensagens (WhatsApp):</strong> processamos números de
        telefone e o conteúdo das mensagens de recuperação enviadas e recebidas,
        por meio da WhatsApp Business Cloud API (Meta), para operar o serviço em
        nome dos nossos usuários.
      </P>
      <P>
        <strong>Dados de uso:</strong> registros técnicos, logs e métricas de
        utilização da plataforma.
      </P>

      <H>3. Como usamos os dados</H>
      <P>
        Utilizamos os dados para: operar a recuperação de vendas e o envio de
        mensagens; medir resultados (conversão, recuperação); processar
        assinaturas e comissões; prestar suporte; cumprir obrigações legais; e
        melhorar a plataforma.
      </P>

      <H>4. Papéis (LGPD)</H>
      <P>
        Em relação aos dados dos <strong>clientes finais</strong> (destinatários das
        mensagens), o nosso usuário (infoprodutor) atua como controlador e a
        LoopSale atua como <strong>operadora</strong>, tratando os dados conforme as
        instruções do usuário. Em relação aos <strong>dados de conta</strong> dos
        nossos usuários, a LoopSale atua como controladora.
      </P>

      <H>5. Compartilhamento</H>
      <P>
        Compartilhamos dados apenas com provedores necessários à operação:{" "}
        <strong>Meta (WhatsApp Cloud API)</strong> para envio de mensagens;{" "}
        <strong>Stripe</strong> para pagamentos; e provedores de infraestrutura em
        nuvem. Não vendemos dados pessoais.
      </P>

      <H>6. Base legal</H>
      <P>
        Tratamos dados com base na execução de contrato, no legítimo interesse, no
        cumprimento de obrigação legal e, quando aplicável, no consentimento. Cabe
        ao nosso usuário garantir base legal e consentimento adequados para
        contatar seus próprios clientes.
      </P>

      <H>7. Retenção</H>
      <P>
        Mantemos os dados pelo tempo necessário à prestação do serviço e ao
        cumprimento de obrigações legais. Encerrada a conta, os dados são excluídos
        ou anonimizados, ressalvadas as hipóteses de guarda obrigatória.
      </P>

      <H>8. Seus direitos</H>
      <P>
        Você pode solicitar acesso, correção, portabilidade, anonimização e
        exclusão dos seus dados, além de revogar consentimento. Usuários podem
        exportar ou excluir seus dados diretamente em{" "}
        <strong>Configurações → Privacidade</strong>, ou pelos canais abaixo. Veja
        também a página de <a className="text-[var(--loop-primary)] hover:underline" href="/exclusao-de-dados">Exclusão de dados</a>.
      </P>

      <H>9. Segurança</H>
      <P>
        Adotamos medidas técnicas e organizacionais para proteger os dados, como
        controle de acesso, criptografia em trânsito e isolamento por conta.
      </P>

      <H>10. Contato</H>
      <P>
        Encarregado/DPO e canal de privacidade:{" "}
        <strong>contato@loopsale.com.br</strong>. Operadora: MIOS TECH SOFTWARE
        HOUSE LTDA.
      </P>
    </LegalShell>
  );
}
