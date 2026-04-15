import { Card, CardContent, CardHeader } from "@/components/ui";

export default function FluxosPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--loop-text)] mb-6">
        Fluxos de recuperação
      </h1>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Seus fluxos
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Crie e edite sequências de mensagens para recuperar carrinhos
            abandonados.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-[var(--loop-text-muted)]">
            Nenhum fluxo criado. Configure integrações primeiro e depois crie
            seu primeiro fluxo (10 min, 6h, 24h, 48h).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
