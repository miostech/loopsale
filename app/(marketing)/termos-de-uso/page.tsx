import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Termos de Uso — LoopSale",
  description:
    "Termos de uso da plataforma LoopSale, operada por MIOS TECH SOFTWARE HOUSE LTDA.",
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

export default function TermosDeUsoPage() {
  return (
    <LegalShell title="Termos de Uso" updatedAt="28/07/2026">
      <P>
        Estes Termos regem o uso da plataforma <strong>LoopSale</strong>, operada
        por <strong>MIOS TECH SOFTWARE HOUSE LTDA</strong>. Ao criar uma conta ou
        usar o serviço, você concorda com estes Termos.
      </P>

      <H>1. O serviço</H>
      <P>
        A LoopSale é uma plataforma de recuperação de vendas e pós-venda que se
        integra a plataformas de checkout e ao WhatsApp para automatizar a
        comunicação com clientes, medir a recuperação e apoiar campanhas.
      </P>

      <H>2. Conta e elegibilidade</H>
      <P>
        Você deve fornecer informações verdadeiras e manter suas credenciais em
        sigilo. É responsável por toda atividade realizada na sua conta e deve ter
        capacidade legal para contratar.
      </P>

      <H>3. Uso aceitável</H>
      <P>
        Você concorda em não usar a plataforma para envio de spam, mensagens não
        autorizadas, conteúdo ilícito, enganoso ou que viole direitos de
        terceiros, nem em desacordo com as políticas do WhatsApp/Meta e das
        plataformas de checkout integradas.
      </P>

      <H>4. Responsabilidades do usuário</H>
      <P>
        Você é o responsável pela relação com seus próprios clientes, incluindo a
        obtenção de consentimento e base legal para contatá-los, o conteúdo das
        mensagens e a conformidade com a LGPD e com as regras da Meta. A LoopSale
        atua como operadora desses dados, conforme suas instruções.
      </P>

      <H>5. WhatsApp e provedores</H>
      <P>
        O envio de mensagens depende da WhatsApp Business Cloud API (Meta) e está
        sujeito às políticas, templates aprovados e limites da Meta. Pagamentos são
        processados via Stripe. A disponibilidade desses provedores pode afetar o
        serviço.
      </P>

      <H>6. Planos, comissões e pagamento</H>
      <P>
        O uso pode envolver assinatura e/ou comissão sobre vendas recuperadas,
        conforme o plano contratado e informado na plataforma. Valores, cobranças e
        condições são apresentados na área de Planos e assinatura.
      </P>

      <H>7. Propriedade intelectual</H>
      <P>
        A plataforma, marca e software são de titularidade da MIOS TECH SOFTWARE
        HOUSE LTDA. Estes Termos não transferem qualquer direito de propriedade
        intelectual.
      </P>

      <H>8. Limitação de responsabilidade</H>
      <P>
        A plataforma é fornecida &quot;no estado em que se encontra&quot;. Na máxima
        extensão permitida em lei, a LoopSale não se responsabiliza por lucros
        cessantes ou danos indiretos decorrentes do uso do serviço.
      </P>

      <H>9. Encerramento</H>
      <P>
        Você pode encerrar sua conta a qualquer momento em Configurações. Podemos
        suspender ou encerrar contas que violem estes Termos ou as políticas dos
        provedores integrados.
      </P>

      <H>10. Alterações e contato</H>
      <P>
        Podemos atualizar estes Termos, com aviso na plataforma. Dúvidas:{" "}
        <strong>contato@loopsale.com.br</strong>. Operadora: MIOS TECH SOFTWARE
        HOUSE LTDA.
      </P>
    </LegalShell>
  );
}
