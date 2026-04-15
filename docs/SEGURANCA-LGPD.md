# Segurança e Conformidade LGPD - LoopSale

## Visão geral

Este documento descreve as práticas de segurança e conformidade com a Lei Geral de Proteção de Dados (LGPD) adotadas ou recomendadas para a plataforma LoopSale.

## LGPD

### Direitos do titular

- **Acesso/Portabilidade**: uso do endpoint `GET /api/me/export` (autenticado) para exportar dados da conta em JSON.
- **Eliminação**: uso do endpoint `POST /api/me/delete-account` com `{ "confirm": true }` para solicitar exclusão da conta e dados associados (exclusão em cascata).

### Boas práticas implementadas

- Senhas armazenadas com hash (bcrypt).
- Tokens de webhook e integrações armazenados por conta; recomenda-se criptografia em repouso (ex.: coluna `integrations.config` criptografada com chave por ambiente).
- Sessões via JWT com expiração configurável.
- Controle de acesso por conta (tenant): usuários só acessam dados da própria conta.

### Recomendações

- Exibir política de privacidade e termos de uso no cadastro e na área logada.
- Registrar consentimento e finalidade ao capturar lead (ex.: campo `consent` e `purpose` na origem do lead).
- Log de acessos a dados pessoais (auditoria) em ambiente de produção.
- MFA (autenticação em dois fatores): integrar com provedor de auth (ex.: NextAuth com provedor TOTP) quando necessário.

## Segurança técnica

### Autenticação

- NextAuth com estratégia JWT e secret em variável de ambiente (`NEXTAUTH_SECRET`).
- Rotas do dashboard protegidas por middleware; APIs verificam sessão.

### Webhooks

- Validação por token na URL (`?token=...`), armazenado por integração.
- Recomenda-se validar assinatura HMAC quando a plataforma (Kiwify/Hotmart) fornecer.
- Rate limiting recomendado na rota de webhooks (evitar abuso).

### Rate limiting

- Módulo `lib/rate-limit.ts` disponível para uso em rotas públicas.
- Em produção, usar solução distribuída (Redis, Vercel KV, Upstash) para contagem entre instâncias.

### Proteção contra spam

- Limites de envio por canal (Resend, Twilio) devem ser respeitados.
- Recomenda-se cooldown por lead (ex.: não enviar mais de N mensagens em X horas) na lógica de agendamento.

## Escalabilidade

- **Eventos**: webhooks persistem eventos no banco e podem enfileirar jobs (Inngest, Trigger.dev, Bull + Redis) para processamento assíncrono.
- **Mensagens agendadas**: cron `GET /api/cron/process-scheduled-messages` processa em lotes (ex.: 50 por execução); aumentar frequência do cron ou workers conforme volume.
- **Envios em massa**: campanhas devem usar filas e batching para respeitar rate limits dos provedores de email/SMS/WhatsApp.
- **Banco**: usar PostgreSQL gerenciado com réplicas e backups automáticos; connection pooling (ex.: PgBouncer) em alta carga.

## Variáveis de ambiente sensíveis

- `NEXTAUTH_SECRET`: gerar com `openssl rand -base64 32`.
- `DATABASE_URL`: não versionar; usar secrets no ambiente de deploy.
- `CRON_SECRET`: proteger rotas de cron.
- Chaves de API (Resend, Twilio, OpenAI): apenas em ambiente seguro.
