import { Card, CardContent, CardHeader } from "@/components/ui";

export default function IntegracoesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--loop-text)] mb-6">
        Integrações
      </h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">Kiwify</h2>
            <p className="text-sm text-[var(--loop-text-muted)]">
              Conecte sua loja Kiwify para receber eventos de checkout
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--loop-text-muted)]">
              Em breve: configuração de webhook e chave de API.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-[var(--loop-text)]">Hotmart</h2>
            <p className="text-sm text-[var(--loop-text-muted)]">
              Conecte sua conta Hotmart para receber eventos de checkout
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--loop-text-muted)]">
              Em breve: configuração de webhook e chave de API.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
