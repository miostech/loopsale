import Link from "next/link";
import { Button, Accordion } from "@/components/ui";
import { LoopSaleLogo } from "@/components/brand/LoopSaleLogo";
import { WhatsAppMockup } from "@/components/marketing/WhatsAppMockup";
import { DemoDashboardButton } from "@/components/marketing/DemoDashboardButton";
import { MarketingMobileMenu } from "@/components/marketing/MarketingMobileMenu";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";

const RECURSOS_GRID = [
  {
    label: "RECUPERE VENDAS",
    title: "Checkout abandonado",
    description:
      "Lembretes automáticos e ofertas personalizadas no WhatsApp, E-mail e SMS para trazer de volta quem não finalizou a compra do seu infoproduto.",
  },
  {
    label: "INCENTIVE RECOMPRA",
    title: "Bônus e cupom",
    description:
      "Ative descontos para a próxima compra e aumente a recompra com campanhas de bônus e upsell direto no WhatsApp.",
  },
  {
    label: "INFORME E ENGAJE",
    title: "Código de acesso e pós-venda",
    description:
      "Envie confirmação de compra, código de acesso e atualizações pelo E-mail e WhatsApp. Reduza dúvidas e aumente a satisfação.",
  },
  {
    label: "CRIE RELACIONAMENTO",
    title: "Aniversário e gatilhos",
    description:
      "Parabenize seus clientes no WhatsApp com cupons ou condições especiais e dispare mensagens por comportamento (visualizou, não comprou).",
  },
  {
    label: "RECEBA FEEDBACKS",
    title: "Pesquisa de NPS",
    description:
      "Colete feedback rápido via E-mail ou WhatsApp e identifique promotores e pontos de melhoria no seu funil.",
  },
  {
    label: "CONVERTA PAGAMENTOS",
    title: "PIX e boletos não pagos",
    description:
      "Automatize lembretes e recupere pagamentos em aberto antes do vencimento.",
  },
];

const DEPOIMENTOS = [
  {
    quote:
      "O que eu mais gosto na LoopSale é a clareza que ela me dá para ver os dados do meu funil. Consigo enxergar meus leads, segmentar e acompanhar resultados. Ferramenta simples de usar e poderosa para quem quer crescer de forma organizada.",
    author: "Ana Silva",
    role: "Produtora de cursos",
  },
  {
    quote:
      "A LoopSale impulsiona meus lançamentos. Uso muito a recuperação de checkout e sempre vejo um ROI altíssimo. Oferecer a oferta certa no momento certo aumentou meu faturamento de forma contínua.",
    author: "Carlos Mendes",
    role: "Afiliado",
  },
  {
    quote:
      "Diferente de outras ferramentas, a LoopSale realmente me traz mais vendas usando a base que muitas vezes fica abandonada. Está cada vez mais caro trazer novos clientes; trabalhar com os que já passaram pelo checkout é essencial.",
    author: "Fernanda Costa",
    role: "Infoprodutora",
  },
];

const FAQ_ITEMS = [
  {
    title: "Posso usar meu número atual de WhatsApp com a LoopSale?",
    children:
      "Sim. Você pode usar o mesmo número que já utiliza no WhatsApp. A LoopSale cuida do processo de ativação ou migração para o WhatsApp API, garantindo uma transição simples e segura.",
  },
  {
    title: "Como funciona a integração com Kiwify e Hotmart?",
    children:
      "A integração é feita por webhooks oficiais: conecte sua conta em poucos cliques, sem necessidade de desenvolvedor. A LoopSale recebe em tempo real eventos de checkout iniciado, abandonado e pagamento aprovado.",
  },
  {
    title: "Existe limite de mensagens enviadas no WhatsApp?",
    children:
      "Os limites dependem da política da Meta para WhatsApp Business API. A LoopSale não impõe limites adicionais de disparo; você pode configurar quantos passos e canais precisar nos seus fluxos.",
  },
  {
    title: "Como é a implantação da LoopSale?",
    children:
      "Conecte sua plataforma (Kiwify ou Hotmart), configure os fluxos de recuperação (horários e mensagens) e ative. Em menos de 24h você pode estar recuperando checkouts abandonados. Oferecemos suporte na configuração.",
  },
  {
    title: "Posso usar E-mail e SMS além do WhatsApp?",
    children:
      "Sim. A LoopSale é multicanal: você escolhe WhatsApp, E-mail e/ou SMS para cada passo dos fluxos, conforme a estratégia do seu funil.",
  },
];

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-[var(--loop-bg)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--loop-border)] bg-[color-mix(in_srgb,var(--loop-bg)_92%,transparent)] backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--loop-bg)_85%,transparent)] transition-shadow duration-300 relative">
        <div className="mx-auto flex min-h-32 max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <LoopSaleLogo href="/" variant="full" />
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#como-funciona"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Como funciona
            </a>
            <a
              href="#recursos"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Recursos
            </a>
            <a
              href="#depoimentos"
              className="text-sm text-[var(--loop-text-muted)] hover:text-[var(--loop-text)]"
            >
              Cases
            </a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <DemoDashboardButton />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Entrar
              </Button>
            </Link>
            <Link href="/agendamento-demo">
              <Button variant="cta" size="sm">
                Agendar demo
              </Button>
            </Link>
          </div>
          <MarketingMobileMenu />
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-6 py-20 md:py-28 lg:py-36">
          <div className="marketing-hero-mesh" aria-hidden />
          <div className="marketing-hero-grid" aria-hidden />
          <div className="relative mx-auto max-w-4xl text-center marketing-hero-enter">
            <p className="marketing-ping-dot mb-4 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--loop-primary)_25%,var(--loop-border))] bg-[color-mix(in_srgb,var(--loop-primary-muted)_55%,var(--loop-bg))] px-4 py-1.5 text-sm font-medium uppercase tracking-wider text-[var(--loop-primary)] shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--loop-primary)] opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--loop-primary)]" />
              </span>
              Plataforma de retenção
            </p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-[var(--loop-text)] md:text-5xl lg:text-[3.35rem] lg:leading-[1.06]">
              CRM de Retenção e Pós-venda para{" "}
              <span className="marketing-gradient-text">Infoprodutores</span>
            </h1>
            <p className="mx-auto mt-6 text-xl font-medium text-[var(--loop-text)] md:text-2xl md:font-semibold">
              Conversas que fazem seu infoproduto vender de novo
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--loop-text-muted)]">
              Recupere checkout abandonado, nutra leads e automatize sua
              comunicação com WhatsApp, E-mail e SMS. Feito para Kiwify e
              Hotmart.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/agendamento-demo" className="w-full sm:w-auto">
                <Button
                  variant="cta"
                  size="lg"
                  className="w-full transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
                >
                  Solicitar demo
                </Button>
              </Link>
              <Link href="#depoimentos" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
                >
                  Ver cases
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Visão 360 */}
        <section className="border-t border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-6 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <RevealOnScroll>
              <h2 className="text-2xl font-bold text-[var(--loop-text)] md:text-3xl">
                Tenha uma visão 360º do seu funil
              </h2>
              <p className="mt-3 text-lg text-[var(--loop-text-muted)]">
                Use WhatsApp, E-mail e SMS juntos
              </p>
              <p className="mt-2 text-sm font-medium uppercase tracking-wider text-[var(--loop-primary)]">
                Ações que viram vendas reais
              </p>
            </RevealOnScroll>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {[
                { icon: "📱", label: "WhatsApp" },
                { icon: "✉️", label: "E-mail" },
                { icon: "💬", label: "SMS" },
              ].map((ch, i) => (
                <RevealOnScroll key={ch.label} delayMs={i * 80}>
                  <div className="group flex flex-col items-center gap-2">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--loop-primary-muted)] text-2xl shadow-inner ring-1 ring-[color-mix(in_srgb,var(--loop-primary)_12%,transparent)] transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:ring-[color-mix(in_srgb,var(--loop-primary)_28%,transparent)]">
                      {ch.icon}
                    </span>
                    <span className="text-sm font-medium text-[var(--loop-text)]">
                      {ch.label}
                    </span>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* Como a LoopSale funciona */}
        <section
          id="como-funciona"
          className="border-t border-[var(--loop-border)] px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <RevealOnScroll>
              <h2 className="text-center text-3xl font-bold text-[var(--loop-text)] md:text-4xl">
                Como a LoopSale funciona
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-center text-[var(--loop-text-muted)]">
                Configure uma vez. Recupere vendas sempre.
              </p>
            </RevealOnScroll>
            <div className="mt-16 grid gap-10 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Conecte",
                  body: "Integre Kiwify ou Hotmart em poucos cliques. Webhooks em tempo real para checkout iniciado, abandonado e pagamento aprovado. Base organizada e pronta para uso.",
                },
                {
                  step: "2",
                  title: "Segmente",
                  body: "Defina a sequência de recuperação (10 min, 6h, 24h, 48h). Escolha WhatsApp, E-mail ou SMS e personalize as mensagens por produto e comportamento.",
                },
                {
                  step: "3",
                  title: "Ative",
                  body: "A LoopSale envia as mensagens automaticamente. Acompanhe checkouts recuperados, taxa de conversão e valor no dashboard.",
                },
              ].map((card, i) => (
                <RevealOnScroll key={card.step} delayMs={i * 90}>
                  <div className="marketing-card-lift h-full rounded-2xl border border-[var(--loop-border)] bg-[var(--loop-bg)] p-8 shadow-sm">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--loop-primary-muted)] to-[color-mix(in_srgb,var(--loop-primary-muted)_40%,var(--loop-bg))] text-xl font-bold text-[var(--loop-primary)] ring-1 ring-[color-mix(in_srgb,var(--loop-primary)_15%,transparent)]">
                      {card.step}
                    </span>
                    <h3 className="mt-6 text-xl font-semibold text-[var(--loop-text)]">
                      {card.title}
                    </h3>
                    <p className="mt-3 text-[var(--loop-text-muted)]">
                      {card.body}
                    </p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* Recursos na prática */}
        <section
          id="recursos"
          className="border-t border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <RevealOnScroll>
              <h2 className="text-center text-3xl font-bold text-[var(--loop-text)] md:text-4xl">
                A retenção na prática
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-center text-[var(--loop-text-muted)]">
                Checkout, pós-venda e insights no WhatsApp, E-mail e SMS.
              </p>
            </RevealOnScroll>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {RECURSOS_GRID.map((item, i) => (
                <RevealOnScroll key={item.label} delayMs={(i % 3) * 70}>
                  <div className="marketing-card-lift group h-full rounded-xl border border-[var(--loop-border)] bg-[var(--loop-bg)] p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--loop-primary)] transition-colors group-hover:text-[var(--loop-primary-hover)]">
                      {item.label}
                    </p>
                    <h3 className="mt-2 font-semibold text-[var(--loop-text)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--loop-text-muted)]">
                      {item.description}
                    </p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* Demonstração WhatsApp */}
        <section className="border-t border-[var(--loop-border)] px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <RevealOnScroll>
              <h2 className="text-center text-3xl font-bold text-[var(--loop-text)] md:text-4xl">
                Veja na prática
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-center text-[var(--loop-text-muted)]">
                As mensagens são enviadas automaticamente de acordo com o cenário configurado. Veja alguns exemplos de mensagens automáticas no WhatsApp.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delayMs={120} className="mt-12 flex justify-center">
              <WhatsAppMockup />
            </RevealOnScroll>
          </div>
        </section>

        {/* Depoimentos */}
        <section
          id="depoimentos"
          className="border-t border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-6 py-20"
        >
          <div className="mx-auto max-w-6xl">
            <RevealOnScroll>
              <h2 className="text-center text-3xl font-bold text-[var(--loop-text)] md:text-4xl">
                Quem usa recomenda
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-center text-[var(--loop-text-muted)]">
                O que produtores e afiliados falam da LoopSale
              </p>
            </RevealOnScroll>
            <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {DEPOIMENTOS.map((d, i) => (
                <RevealOnScroll key={d.author} delayMs={i * 85}>
                  <div className="marketing-card-lift h-full rounded-2xl border border-[var(--loop-border)] bg-[var(--loop-bg)] p-6 shadow-sm">
                    <p className="text-[var(--loop-text)]">
                      &ldquo;{d.quote}&rdquo;
                    </p>
                    <p className="mt-4 font-semibold text-[var(--loop-text)]">
                      {d.author}
                    </p>
                    <p className="text-sm text-[var(--loop-text-muted)]">
                      {d.role}
                    </p>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        {/* Planos / CTA */}
        <section className="border-t border-[var(--loop-border)] px-6 py-20">
          <RevealOnScroll>
            <div className="marketing-card-lift mx-auto max-w-2xl rounded-2xl border border-[var(--loop-border)] bg-[linear-gradient(145deg,var(--loop-bg-alt)_0%,color-mix(in_srgb,var(--loop-primary-muted)_35%,var(--loop-bg-alt))_100%)] p-10 text-center shadow-sm md:p-14">
            <h2 className="text-2xl font-bold text-[var(--loop-text)] md:text-3xl">
              Planos personalizados
            </h2>
            <p className="mt-4 text-[var(--loop-text-muted)]">
              Cada operação tem um ritmo. A LoopSale monta o plano certo para sua
              realidade: módulos e canais conforme sua estratégia, ajustado ao
              seu volume. Sem vigência mínima de contrato.
            </p>
            <div className="mt-8">
              <Link href="/agendamento-demo">
                <Button variant="cta" size="lg">
                  Quero minha proposta
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--loop-text-muted)]">
              Resposta em até 24h úteis.
            </p>
            </div>
          </RevealOnScroll>
        </section>

        {/* FAQ */}
        <section className="border-t border-[var(--loop-border)] bg-[var(--loop-bg-alt)] px-6 py-20">
          <div className="mx-auto max-w-2xl">
            <RevealOnScroll>
              <h2 className="text-center text-3xl font-bold text-[var(--loop-text)] md:text-4xl">
                Perguntas frequentes
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-center text-[var(--loop-text-muted)]">
                Respostas rápidas sobre retenção, integrações e uso do WhatsApp.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delayMs={100} className="mt-12">
              <Accordion items={FAQ_ITEMS} />
            </RevealOnScroll>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t border-[var(--loop-border)] px-6 py-20">
          <RevealOnScroll>
            <div className="marketing-card-lift relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-[var(--loop-border)] bg-[var(--loop-bg-alt)] p-10 text-center shadow-sm md:p-14">
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--loop-primary)_18%,transparent)] blur-3xl"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -bottom-20 -left-16 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--loop-cta)_12%,transparent)] blur-3xl"
                aria-hidden
              />
              <div className="relative">
                <h2 className="text-2xl font-bold text-[var(--loop-text)] md:text-3xl">
                  Transforme sua base em vendas recorrentes com a LoopSale
                </h2>
                <p className="mt-4 text-[var(--loop-text-muted)]">
                  Comece a recuperar vendas em poucos passos. Sem cartão de
                  crédito.
                </p>
                <div className="mt-8">
                  <Link href="/agendamento-demo">
                    <Button
                      variant="cta"
                      size="lg"
                      className="transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Iniciar demo
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--loop-border)] bg-[var(--loop-bg)] px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <p className="mb-8 text-center text-sm text-[var(--loop-text-muted)]">
              Uma plataforma única para retenção de clientes no seu infoproduto.
            </p>
            <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start">
              <div>
                <LoopSaleLogo href="/" variant="mark" className="inline-flex" />
                <ul className="mt-4 space-y-1 text-sm text-[var(--loop-text-muted)]">
                  <li>
                    <a href="#" className="hover:text-[var(--loop-text)]">
                      Sobre
                    </a>
                  </li>
                  <li>
                    <a href="#como-funciona" className="hover:text-[var(--loop-text)]">
                      Plataforma
                    </a>
                  </li>
                  <li>
                    <a href="#recursos" className="hover:text-[var(--loop-text)]">
                      Integrações
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <span className="text-sm font-medium text-[var(--loop-text)]">
                  Recursos
                </span>
                <ul className="mt-3 space-y-1 text-sm text-[var(--loop-text-muted)]">
                  <li>
                    <a href="#depoimentos" className="hover:text-[var(--loop-text)]">
                      Cases
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-[var(--loop-text)]">
                      Academy
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <span className="text-sm font-medium text-[var(--loop-text)]">
                  Legal
                </span>
                <ul className="mt-3 space-y-1 text-sm text-[var(--loop-text-muted)]">
                  <li>
                    <a href="#" className="hover:text-[var(--loop-text)]">
                      Termos de uso
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-[var(--loop-text)]">
                      Política de privacidade
                    </a>
                  </li>
                </ul>
              </div>
              <div className="flex flex-col items-center gap-2 md:items-end">
                <div className="flex gap-3">
                  <Link href="/login">
                    <Button variant="ghost" size="sm">
                      Entrar
                    </Button>
                  </Link>
                  <Link href="/agendamento-demo">
                    <Button variant="cta" size="sm">
                      Agendar demo
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
            <p className="mt-10 text-center text-sm text-[var(--loop-text-muted)]">
              © {new Date().getFullYear()} LoopSale. Todos os direitos reservados.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
