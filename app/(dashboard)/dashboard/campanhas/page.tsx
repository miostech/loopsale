import { Card, CardContent, CardHeader } from "@/components/ui";

export default function CampanhasPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--loop-text)] mb-6">
        Campanhas
      </h1>
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[var(--loop-text)]">
            Campanhas promocionais
          </h2>
          <p className="text-sm text-[var(--loop-text-muted)]">
            Lançamentos, recuperação de leads antigos, upsell e ofertas.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-[var(--loop-text-muted)]">
            Em breve: criação de campanhas por segmento e evento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
